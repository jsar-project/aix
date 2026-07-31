use aix_pack::{InputFile, OptimizeOptions, PackOptions};
use anyhow::Result;
use clap::{Parser, Subcommand};
use ignore::WalkBuilder;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Parser)]
#[command(name = "aix")]
#[command(about = "Ink AIX Package Manager", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Pack a directory into a .aix file
    Pack {
        /// Input directory to pack
        #[arg(value_name = "INPUT_DIR")]
        input_dir: PathBuf,

        /// Output .aix file path (optional, defaults to bundle.aix)
        #[arg(short, long, value_name = "OUTPUT_FILE")]
        output: Option<PathBuf>,

        /// Enable optimization
        #[arg(short = 'O', long, default_value_t = false)]
        optimize: bool,

        /// Optimization level (1-3)
        #[arg(long, default_value_t = 2, value_parser = clap::value_parser!(u8).range(1..=3))]
        opt_level: u8,
    },
    /// List the contents of a .aix file
    #[command(alias = "ls")]
    List {
        /// Path to the .aix file
        #[arg(value_name = "AIX_FILE")]
        file: PathBuf,
    },
    /// Optimize an existing .aix file
    Optimize {
        /// Path to the input .aix file
        #[arg(value_name = "AIX_FILE")]
        file: PathBuf,

        /// Output .aix file path
        #[arg(short, long, value_name = "OUTPUT_FILE")]
        output: PathBuf,

        /// Optimization level (1-3)
        #[arg(long, default_value_t = 2, value_parser = clap::value_parser!(u8).range(1..=3))]
        level: u8,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match &cli.command {
        Commands::Pack {
            input_dir,
            output,
            optimize,
            opt_level,
        } => {
            let output_path = output
                .clone()
                .unwrap_or_else(|| PathBuf::from("bundle.aix"));
            pack_directory(input_dir, &output_path, *optimize, *opt_level)?;
            println!("Successfully packed {:?} to {:?}", input_dir, output_path);
        }
        Commands::List { file } => {
            list_aix(file)?;
        }
        Commands::Optimize {
            file,
            output,
            level,
        } => optimize_aix(file, output, *level)?,
    }

    Ok(())
}

fn pack_directory(src_dir: &Path, dst_file: &Path, optimize: bool, opt_level: u8) -> Result<()> {
    if !src_dir.is_dir() {
        return Err(anyhow::anyhow!("Input path is not a directory"));
    }

    let uuid = Uuid::new_v4().to_string();
    println!("Generated UUID: {}", uuid);

    // Use ignore::WalkBuilder to respect .aixignore and other ignore files
    let walker = WalkBuilder::new(src_dir)
        .add_custom_ignore_filename(".aixignore")
        .build();

    let mut files = Vec::new();

    for result in walker {
        let entry = result?;
        let path = entry.path();

        // Compute relative path
        let name = path.strip_prefix(src_dir)?;
        let path_as_string = name.to_string_lossy().replace("\\", "/"); // normalize for zip

        if path.is_file() {
            let mut f = File::open(path)?;
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer)?;
            files.push(InputFile::new(path_as_string, buffer));
        }
    }
    let output = aix_pack::pack(
        files,
        PackOptions {
            build_id: uuid,
            optimize: optimize.then(|| OptimizeOptions {
                level: opt_level,
                ..OptimizeOptions::default()
            }),
        },
    )?;
    std::fs::write(dst_file, output.data)?;

    for file in &output.report.files {
        if file.converted_to_utf8 {
            println!("Converted {} to UTF-8 for packaging", file.path);
        }
        if file.status == aix_pack::OptimizeStatus::Optimized {
            println!(
                "Optimized {}: {} -> {} (saved {})",
                file.path,
                format_size(file.original_size),
                format_size(file.output_size),
                format_size(file.saved_bytes)
            );
        } else if file.path != "VERSION" {
            println!("Adding file: {}", file.path);
        }
    }

    let final_package_size = std::fs::metadata(dst_file)?.len();
    println!(
        "Package created: {:?} ({})",
        dst_file,
        format_size(final_package_size)
    );

    if optimize && output.report.original_size > 0 {
        let ratio = (output.report.saved_bytes as f64 / output.report.original_size as f64) * 100.0;
        println!(
            "Optimization Summary: Total saved {} ({:.2}%)",
            format_size(output.report.saved_bytes),
            ratio
        );
    }

    Ok(())
}

fn optimize_aix(input: &Path, output: &Path, level: u8) -> Result<()> {
    let data = std::fs::read(input)?;
    let optimized = aix_pack::optimize_package(
        &data,
        &OptimizeOptions {
            level,
            ..OptimizeOptions::default()
        },
    )?;
    std::fs::write(output, optimized.data)?;
    println!(
        "Optimized {:?} to {:?} (saved {})",
        input,
        output,
        format_size(optimized.report.saved_bytes)
    );
    Ok(())
}

fn list_aix(file_path: &Path) -> Result<()> {
    let mut file = File::open(file_path)?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;

    let reader = aix::AixReader::new(buffer)?;

    println!("Contents of {:?}:", file_path);
    for entry in reader.list() {
        println!(
            "{}: {} (compressed: {})",
            entry.name,
            aix::format_size(entry.size),
            aix::format_size(entry.compressed_size)
        );
    }
    Ok(())
}

fn format_size(bytes: u64) -> String {
    aix::format_size(bytes)
}
