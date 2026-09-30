import { describe, expect, it } from "vitest";
import { DEFAULT_VAULT_QUESTION } from "../src/consts";
import { renderQuestionHtml } from "../src/mdast/question-html";

const render = (markdown: string) => `<p>${markdown}</p>`;

describe("renderQuestionHtml", () => {
  it("renders the authored question", () => {
    const frontmatter: Record<string, unknown> = {
      passwordHash: "$argon2id$...",
      question: "What is 2 + 2?",
    };

    renderQuestionHtml(frontmatter, render);

    expect(frontmatter.questionHtml).toBe("<p>What is 2 + 2?</p>");
  });

  it("falls back to the default question for vault entries without one", () => {
    const frontmatter: Record<string, unknown> = {
      passwordHash: "$argon2id$...",
    };

    renderQuestionHtml(frontmatter, render);

    expect(frontmatter.questionHtml).toBe(`<p>${DEFAULT_VAULT_QUESTION}</p>`);
  });

  it("renders when only a question is present", () => {
    const frontmatter: Record<string, unknown> = { question: "Hi" };

    renderQuestionHtml(frontmatter, render);

    expect(frontmatter.questionHtml).toBe("<p>Hi</p>");
  });

  it("leaves non-vault frontmatter untouched", () => {
    const frontmatter: Record<string, unknown> = { title: "An article" };

    renderQuestionHtml(frontmatter, render);

    expect(frontmatter).not.toHaveProperty("questionHtml");
  });
});
