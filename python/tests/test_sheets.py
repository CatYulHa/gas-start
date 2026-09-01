import datetime as dt

import pandas as pd

from gasstart_sheets.sample import sample_frame
from gasstart_sheets.sheets import df_to_values, spreadsheet_key, values_to_df, write_values


class FakeWorksheet:
    def __init__(self, values=None):
        self.values = values or []
        self.cleared = False
        self.size = None
        self.updates = []

    def get_all_values(self):
        return self.values

    def clear(self):
        self.cleared = True
        self.values = []

    def resize(self, rows=None, cols=None):
        self.size = (rows, cols)

    def update(self, range_name, values, **kwargs):
        self.updates.append((range_name, values, kwargs))
        self.values = values


def test_values_to_df_parses_header_numbers_and_blank_rows():
    values = [
        ["date", "category", "value", ""],
        ["2026-01-01", "Web", "120", ""],
        ["", "", "", ""],
        ["2026-01-02", "Web", "130.5", ""],
    ]
    df = values_to_df(values)
    assert list(df.columns) == ["date", "category", "value"]
    assert len(df) == 2
    assert pd.api.types.is_numeric_dtype(df["value"])
    assert df["value"].tolist() == [120.0, 130.5]
    assert df["date"].tolist() == ["2026-01-01", "2026-01-02"]


def test_values_to_df_keeps_mixed_columns_as_text():
    df = values_to_df([["id"], ["1"], ["abc"]])
    assert df["id"].tolist() == ["1", "abc"]


def test_values_to_df_empty():
    assert values_to_df([]).empty
    assert values_to_df([["a", "b"]]).shape == (0, 2)


def test_df_to_values_serialises_types():
    df = pd.DataFrame(
        {
            "date": [dt.date(2026, 1, 1), pd.Timestamp("2026-01-02")],
            "n": [1, None],
            "flag": [True, False],
            "text": ["a", None],
        }
    )
    values = df_to_values(df)
    assert values[0] == ["date", "n", "flag", "text"]
    assert values[1] == ["2026-01-01", 1.0, True, "a"]
    assert values[2] == ["2026-01-02", "", False, ""]


def test_formula_like_strings_are_neutralised_by_default():
    evil = '=IMPORTXML("https://evil", "//a")'
    df = pd.DataFrame({"note": [evil, "+1", "-x", "@user", "plain", "a=b"]})
    values = df_to_values(df)
    assert [r[0] for r in values[1:]] == ["'" + evil, "'+1", "'-x", "'@user", "plain", "a=b"]
    # header cells too
    assert df_to_values(pd.DataFrame(columns=["=cmd"]))[0] == ["'=cmd"]
    # numbers are untouched, opt-in keeps formulas
    assert df_to_values(pd.DataFrame({"n": [-5]}))[1] == [-5]
    assert df_to_values(df, allow_formulas=True)[1] == [evil]


def test_find_secrets_dir_stops_at_repo_root(tmp_path):
    from gasstart_sheets.auth import find_secrets_dir

    (tmp_path / ".secrets").mkdir()  # planted above the repo
    repo = tmp_path / "repo"
    (repo / ".git").mkdir(parents=True)
    inner = repo / "python"
    inner.mkdir()
    assert find_secrets_dir(inner) == (inner / ".secrets").resolve()


def test_roundtrip_through_fake_worksheet():
    df = sample_frame(days=3, end=dt.date(2026, 9, 1))
    ws = FakeWorksheet()
    write_values(ws, df_to_values(df))

    assert ws.cleared
    assert ws.size == (10, 3)  # header + 9 rows, 3 cols
    assert ws.updates[0][0] == "A1"
    assert ws.updates[0][2] == {"value_input_option": "USER_ENTERED"}

    back = values_to_df([[str(c) for c in row] for row in ws.values])
    assert list(back.columns) == ["date", "category", "value"]
    assert back["value"].astype(int).tolist() == df["value"].tolist()
    assert back["category"].tolist() == df["category"].tolist()


def test_sample_frame_is_deterministic_and_well_formed():
    a = sample_frame(days=10, end=dt.date(2026, 9, 1))
    b = sample_frame(days=10, end=dt.date(2026, 9, 1))
    assert a.equals(b)
    assert len(a) == 30
    assert a["date"].min() == "2026-08-23"
    assert a["date"].max() == "2026-09-01"
    assert (a["value"] > 0).all()


def test_find_secrets_dir_walks_up(tmp_path):
    from gasstart_sheets.auth import find_secrets_dir

    root = tmp_path / "repo"
    (root / ".secrets").mkdir(parents=True)
    nested = root / "python" / "examples"
    nested.mkdir(parents=True)

    assert find_secrets_dir(nested) == (root / ".secrets").resolve()
    # No .secrets anywhere above -> default next to the start directory
    lonely = tmp_path / "elsewhere"
    lonely.mkdir()
    assert find_secrets_dir(lonely) == (lonely / ".secrets").resolve()


def test_spreadsheet_key():
    key = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
    assert spreadsheet_key(f"https://docs.google.com/spreadsheets/d/{key}/edit#gid=0") == key
    assert spreadsheet_key(key) == key
    assert spreadsheet_key("My Sheet Title") is None
