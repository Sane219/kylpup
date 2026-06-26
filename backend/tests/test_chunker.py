from scripts.ingest import CHUNK_CHARS, OVERLAP, chunk, source_ref


def test_chunks_are_bounded_and_nonempty():
    text = "\n\n".join(f"Paragraph {i} " + "word " * 80 for i in range(10))
    chunks = chunk(text)
    assert chunks, "expected at least one chunk"
    assert all(len(c) <= CHUNK_CHARS + OVERLAP + 100 for c in chunks)


def test_short_text_single_chunk():
    assert chunk("just a short filing note") == ["just a short filing note"]


def test_source_ref_parses_filename():
    assert source_ref("AAPL_10K_FY2023.txt", 0) == "AAPL 10K FY2023 — chunk 1"
