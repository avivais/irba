import { describe, it, expect } from "vitest";
import {
  parsePlayersCsv,
  parseAggregatesCsv,
  parsePaymentsCsv,
} from "./csv-import";

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

describe("parsePlayersCsv", () => {
  it("parses a full valid players CSV", () => {
    const csv = [
      "nickname,firstNameHe,lastNameHe,firstNameEn,lastNameEn,phone,birthdate,playerKind",
      "אבי,אבי,כהן,Avi,Cohen,0521234567,1990-05-15,REGISTERED",
    ].join("\n");
    const { rows, errors } = parsePlayersCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].nickname).toBe("אבי");
    expect(rows[0].phone).toBe("0521234567");
    expect(rows[0].playerKind).toBe("REGISTERED");
    expect(rows[0].birthdate).toBeInstanceOf(Date);
    expect(rows[0].firstNameHe).toBe("אבי");
    expect(rows[0].lastNameEn).toBe("Cohen");
  });

  it("parses minimal row (nickname only)", () => {
    const csv = "nickname\nעידן";
    const { rows, errors } = parsePlayersCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].nickname).toBe("עידן");
    expect(rows[0].phone).toBeNull();
    expect(rows[0].birthdate).toBeNull();
    expect(rows[0].playerKind).toBe("DROP_IN");
  });

  it("defaults playerKind to DROP_IN when empty", () => {
    const csv = "nickname,playerKind\nדני,";
    const { rows, errors } = parsePlayersCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].playerKind).toBe("DROP_IN");
  });

  it("errors on missing nickname column", () => {
    const csv = "name,phone\nאבי,0521234567";
    const { rows, errors } = parsePlayersCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/nickname/);
  });

  it("errors on empty nickname value", () => {
    const csv = "nickname,phone\n,0521234567";
    const { rows, errors } = parsePlayersCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].rowIndex).toBe(1);
  });

  it("errors on invalid phone", () => {
    const csv = "nickname,phone\nאבי,123";
    const { rows, errors } = parsePlayersCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/טלפון/);
  });

  it("errors on invalid birthdate", () => {
    const csv = "nickname,birthdate\nאבי,not-a-date";
    const { rows, errors } = parsePlayersCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/תאריך/);
  });

  it("parses Israeli D.M.YY birthdate", () => {
    const csv = "nickname,birthdate\nאבי,22.1.82";
    const { rows, errors } = parsePlayersCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].birthdate).toBeInstanceOf(Date);
    expect(rows[0].birthdate?.getFullYear()).toBe(1982);
    expect(rows[0].birthdate?.getMonth()).toBe(0); // January
    expect(rows[0].birthdate?.getDate()).toBe(22);
  });

  it("parses Israeli D.M.YYYY birthdate", () => {
    const csv = "nickname,birthdate\nאבי,27.4.1985";
    const { rows, errors } = parsePlayersCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].birthdate?.getFullYear()).toBe(1985);
    expect(rows[0].birthdate?.getMonth()).toBe(3); // April
    expect(rows[0].birthdate?.getDate()).toBe(27);
  });

  it("returns empty result for empty CSV", () => {
    const { rows, errors } = parsePlayersCsv("");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("parses quoted multi-position field", () => {
    const csv = `nickname,positions\nאבי,"PG,SG"`;
    const { rows, errors } = parsePlayersCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].positions).toEqual(["PG", "SG"]);
  });

  it("parses single unquoted position", () => {
    const csv = "nickname,positions\nאבי,PF";
    const { rows, errors } = parsePlayersCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].positions).toEqual(["PF"]);
  });

  it("errors on invalid position value", () => {
    const csv = "nickname,positions\nאבי,XY";
    const { rows, errors } = parsePlayersCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/עמדה/);
  });
});

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear();

describe("parseAggregatesCsv", () => {
  it("parses valid wide aggregates CSV", () => {
    const csv = [
      "nickname,2022,2023,2024",
      "אבי,12,18,20",
      "עידן,8,0,14",
    ].join("\n");
    const { rows, errors } = parseAggregatesCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(6);
    expect(rows.find((r) => r.nickname === "אבי" && r.year === 2023)?.count).toBe(18);
  });

  it("skips empty cells", () => {
    const csv = "nickname,2022,2023\nאבי,,10";
    const { rows, errors } = parseAggregatesCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].year).toBe(2023);
  });

  it("skips current year column", () => {
    const csv = `nickname,2022,${CURRENT_YEAR}\nאבי,10,5`;
    const { rows } = parseAggregatesCsv(csv);
    expect(rows.every((r) => r.year !== CURRENT_YEAR)).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].year).toBe(2022);
  });

  it("errors when first column is not nickname", () => {
    const csv = "name,2022\nאבי,10";
    const { errors } = parseAggregatesCsv(csv);
    expect(errors[0].message).toMatch(/nickname/);
  });

  it("errors on non-numeric count", () => {
    const csv = "nickname,2022\nאבי,abc";
    const { rows, errors } = parseAggregatesCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/2022/);
  });

  it("errors on negative count", () => {
    const csv = "nickname,2022\nאבי,-5";
    const { rows, errors } = parseAggregatesCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it("returns empty for empty CSV", () => {
    const { rows, errors } = parseAggregatesCsv("");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

describe("parsePaymentsCsv", () => {
  it("parses valid wide payments CSV", () => {
    const csv = [
      "date,אבי,עידן,דימה",
      "2026-01-05,26,31,",
      "2026-01-26,26,31,30",
    ].join("\n");
    const { rows, errors } = parsePaymentsCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.nickname === "דימה")?.amount).toBe(30);
    expect(rows[0].date).toBeInstanceOf(Date);
  });

  it("skips empty cells", () => {
    const csv = "date,אבי,עידן\n2026-01-05,,31";
    const { rows, errors } = parsePaymentsCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].nickname).toBe("עידן");
  });

  it("accepts negative amounts", () => {
    const csv = "date,אבי\n2026-01-05,-27";
    const { rows, errors } = parsePaymentsCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].amount).toBe(-27);
  });

  it("errors on zero amount", () => {
    const csv = "date,אבי\n2026-01-05,0";
    const { rows, errors } = parsePaymentsCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/אפס/);
  });

  it("errors on non-numeric amount", () => {
    const csv = "date,אבי\n2026-01-05,abc";
    const { rows, errors } = parsePaymentsCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/סכום/);
  });

  it("errors when first column is not date", () => {
    const csv = "תאריך,אבי\n2026-01-05,26";
    const { errors } = parsePaymentsCsv(csv);
    expect(errors[0].message).toMatch(/date/);
  });

  it("errors on invalid date", () => {
    const csv = "date,אבי\nnot-a-date,26";
    const { rows, errors } = parsePaymentsCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/תאריך/);
  });

  it("returns empty for empty CSV", () => {
    const { rows, errors } = parsePaymentsCsv("");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});
