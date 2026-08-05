# Specification

AIX is a file format for packaging application structure, page metadata, and schema-defined inputs in a way that remains readable to both tooling and humans.

## What AIX Carries

An AIX package is not only an archive. It is a structured artifact that keeps enough meaning for readers to surface:

- package entries and metadata
- page definitions
- page-level schema
- layout and target hints
- derived tool descriptions

## Why It Matters

Traditional package archives can move bytes reliably, but they do not always preserve enough application intent to become inspectable interface contracts.

AIX is designed to keep the package legible after packaging.

## Core Reading Model

The format story should be understood in this sequence:

1. package files exist as concrete entries
2. app and page metadata define navigable surfaces
3. schema adds data contracts to those surfaces
4. tooling can derive structured interfaces from the package

## Package To Tool Relationship

In AIX, a page is not only a view layer concern. It can also provide enough structure to become a tool surface when schema and layout semantics are available.

That bridge is what gives AIX its format-first value:

- the package remains the source of truth
- schema creates machine-readable input contracts
- tool definitions stay close to the package model

## Reading Paths

Different runtimes can read the same conceptual artifact:

- `crates/aix` reads and analyzes the package
- `crates/aix-cli` and `crates/aix-node-cli` package and inspect it from the command line (native and npm surfaces)
- `crates/aix-web` exposes the reading model in browser environments

## Explore Further

- Continue to [Packages](/packages)
- Open the [Package Lab](/play)
