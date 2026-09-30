export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_PATTERN = /^[A-Za-z0-9!@#$%^&*]+$/;

/*
 * Which part of the rule a password missed, rather than only that it missed one.
 *
 * The unlock form states the rule to the reader and answers a rejected field in
 * the page's own words, so the page has to know which half was broken. It asks
 * here instead of restating the lengths and the character set, so the message a
 * reader is shown cannot describe a rule the server is not the one applying.
 */
export type PasswordProblem = "length" | "characters";

export const findPasswordProblem = (
  value: string,
): PasswordProblem | undefined => {
  if (
    value.length < PASSWORD_MIN_LENGTH ||
    value.length > PASSWORD_MAX_LENGTH
  ) {
    return "length";
  }

  return PASSWORD_PATTERN.test(value) ? undefined : "characters";
};

export const isValidPassword = (value: string): boolean =>
  findPasswordProblem(value) === undefined;
