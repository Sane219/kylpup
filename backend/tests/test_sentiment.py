from app.tools.news import _sentiment


def test_positive():
    label, score = _sentiment("Revenue surge and record profit drive growth")
    assert label == "positive" and score > 0


def test_negative():
    label, score = _sentiment("Earnings miss sparks lawsuit and stock plunge")
    assert label == "negative" and score < 0


def test_neutral():
    label, score = _sentiment("Company holds its annual shareholder meeting")
    assert label == "neutral" and score == 0.0
