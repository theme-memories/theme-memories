import { DEFAULT_VAULT_QUESTION } from "../consts";

type QuestionRenderer = (markdown: string) => string;

export const renderQuestionHtml = (
  frontmatter: Record<string, unknown>,
  render: QuestionRenderer,
): void => {
  // Only vault entries carry a passwordHash; skip every other collection.
  if (
    frontmatter.passwordHash === undefined &&
    frontmatter.question === undefined
  ) {
    return;
  }

  const question =
    typeof frontmatter.question === "string"
      ? frontmatter.question
      : DEFAULT_VAULT_QUESTION;

  frontmatter.questionHtml = render(question);
};
