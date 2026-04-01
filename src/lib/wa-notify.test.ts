import { describe, expect, it } from "vitest";
import { renderTemplate } from "./wa-notify";

describe("renderTemplate", () => {
  it("replaces a single placeholder", () => {
    expect(renderTemplate("שלום {name}", { name: "אבי" })).toBe("שלום אבי");
  });

  it("replaces multiple placeholders", () => {
    const result = renderTemplate("{player_name} נרשם למפגש {date} ({status})", {
      player_name: "דניאל",
      date: "יום שני 7 אפריל",
      status: "מאושר",
    });
    expect(result).toBe("דניאל נרשם למפגש יום שני 7 אפריל (מאושר)");
  });

  it("leaves unknown placeholders as-is", () => {
    expect(renderTemplate("שלום {unknown}", { name: "אבי" })).toBe("שלום {unknown}");
  });

  it("handles a template with no placeholders", () => {
    expect(renderTemplate("הודעה קבועה", {})).toBe("הודעה קבועה");
  });

  it("replaces the same placeholder multiple times", () => {
    expect(renderTemplate("{date} and {date}", { date: "Monday" })).toBe("Monday and Monday");
  });

  it("handles empty string vars", () => {
    expect(renderTemplate("שלום {name}!", { name: "" })).toBe("שלום !");
  });

  it("does not alter surrounding text when replacing", () => {
    expect(renderTemplate("ההרשמה למפגש {date} פתוחה!", { date: "יום שני" })).toBe(
      "ההרשמה למפגש יום שני פתוחה!",
    );
  });
});
