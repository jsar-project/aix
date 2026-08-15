//! Benchmarks for the AixReader read path.
//!
//! These quantify the entry-index optimization: read_file is O(1) in the
//! number of archive entries, so timings should stay flat as the entry count
//! grows (the pre-index implementation rescanned the central directory on every
//! read, which was O(entries)).

use std::io::{Cursor, Write};

use aiui_aix::AixReader;
use criterion::{criterion_group, criterion_main, BatchSize, BenchmarkId, Criterion, Throughput};
use zip::write::FileOptions;

/// Builds a synthetic archive with entry_count small stored text entries plus
/// a minimal app.json.
fn build_archive(entry_count: usize) -> Vec<u8> {
    let mut bytes = Vec::new();
    {
        let mut zip = zip::ZipWriter::new(Cursor::new(&mut bytes));
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Stored);
        zip.start_file("app.json", options).unwrap();
        zip.write_all(br#"{"pages":[]}"#).unwrap();
        for index in 0..entry_count {
            zip.start_file(format!("data/file_{index}.txt"), options)
                .unwrap();
            zip.write_all(b"the quick brown fox jumps over the lazy dog")
                .unwrap();
        }
        zip.finish().unwrap();
    }
    bytes
}

fn bench_reader_new(c: &mut Criterion) {
    let mut group = c.benchmark_group("reader_new");
    for entry_count in [100usize, 1_000, 5_000] {
        let data = build_archive(entry_count);
        group.throughput(Throughput::Elements(entry_count as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(entry_count),
            &data,
            |b, data| {
                b.iter_batched(
                    || data.to_vec(),
                    |data| {
                        let reader = AixReader::new(data).unwrap();
                        criterion::black_box(&reader);
                    },
                    BatchSize::SmallInput,
                );
            },
        );
    }
    group.finish();
}

fn bench_read_file(c: &mut Criterion) {
    let mut group = c.benchmark_group("read_file");
    for entry_count in [100usize, 1_000, 5_000] {
        let reader = AixReader::new(build_archive(entry_count)).unwrap();
        // Reading the final entry was the worst case before indexing: the old
        // implementation scanned the central directory from the start.
        let name = format!("data/file_{}.txt", entry_count - 1);
        group.bench_with_input(
            BenchmarkId::from_parameter(entry_count),
            &name,
            |b, name| {
                b.iter(|| reader.read_file(name).unwrap());
            },
        );
    }
    group.finish();
}

fn bench_read_all(c: &mut Criterion) {
    let mut group = c.benchmark_group("read_all");
    for entry_count in [100usize, 1_000, 5_000] {
        let reader = AixReader::new(build_archive(entry_count)).unwrap();
        let names: Vec<String> = reader
            .list()
            .iter()
            .filter(|entry| !entry.name.ends_with('/'))
            .map(|entry| entry.name.clone())
            .collect();
        group.throughput(Throughput::Elements(entry_count as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(entry_count),
            &names,
            |b, names| {
                b.iter(|| {
                    for name in names {
                        criterion::black_box(reader.read_file(name).unwrap());
                    }
                });
            },
        );
    }
    group.finish();
}

criterion_group!(benches, bench_reader_new, bench_read_file, bench_read_all);
criterion_main!(benches);
