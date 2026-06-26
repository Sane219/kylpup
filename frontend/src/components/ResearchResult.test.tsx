import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ResearchResult from "./ResearchResult";

describe("ResearchResult", () => {
  it("renders each block the agent returns", () => {
    render(<ResearchResult data={{
      summary: "NVDA leads on growth.",
      company_cards: [{ ticker: "NVDA", name: "NVIDIA", price: 120, citation: "yfinance" }],
      comparison_table: { columns: ["Metric", "NVDA"], rows: [["P/E", "60"]] },
      news_sentiment: [{ title: "Beats earnings", sentiment: "positive", url: "#", citation: "news" }],
    }} />);
    expect(screen.getByText("NVDA leads on growth.")).toBeInTheDocument();
    expect(screen.getByText("NVIDIA")).toBeInTheDocument();
    expect(screen.getByText("Comparison")).toBeInTheDocument();
    expect(screen.getByText("Beats earnings")).toBeInTheDocument();
  });

  it("flags a missing citation instead of hiding it", () => {
    render(<ResearchResult data={{ company_cards: [{ ticker: "AAPL", name: "Apple", price: 200 }] }} />);
    expect(screen.getByText(/no source/i)).toBeInTheDocument();
  });

  it("degrades gracefully when a tool's block is absent", () => {
    render(<ResearchResult data={{ summary: "News feed was down; market data only." }} />);
    expect(screen.getByText(/News feed was down/)).toBeInTheDocument();
    expect(screen.queryByText("Comparison")).not.toBeInTheDocument();
  });

  it("shows the empty state for no data", () => {
    render(<ResearchResult data={{}} />);
    expect(screen.getByText("No analysis yet")).toBeInTheDocument();
  });
});
