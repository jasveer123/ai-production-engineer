import json
from typing import Any

from ai_worker.fixing import (
    PATCH_SCHEMA,
    FixContext,
    PatchOut,
    generate_patch,
    generate_test,
    validate_patch,
    validate_test,
)
from ai_worker.llm.gateway import ModelCall

CTX = FixContext.model_validate(
    {
        "fixProposalId": "fix-1",
        "repository": "me/demo-shop",
        "sha": "a" * 40,
        "profile": {"packageDir": "api", "testDir": "test"},
        "incident": {"title": "TypeError percentOff"},
        "hypothesis": {"summary": "discountV2 reads percentOff of undefined", "rationale": "stack"},
        "stack": ["at CheckoutService.discountV2 (/app/api/src/services/checkout.ts:81:46)"],
        "editable": {
            "api/src/services/checkout.ts": (
                "const promo = this.promotions.get(code ?? '') as Coupon;\n"
            )
        },
        "tests": {"api/test/checkout.test.ts": "import { it } from 'vitest';"},
        "packageJson": "{}",
        "testPath": "api/test/ape-regression-x.test.ts",
    }
)

GOOD_TEST = (
    "import { describe, it, expect } from 'vitest';\n"
    "import { CheckoutService } from '../src/services/checkout.js';\n"
    "it('checks out without a coupon', async () => {\n"
    "  expect(new CheckoutService().total(100)).toBe(100);\n"
    "});\n"
)


class Fake:
    name = "fake"

    def __init__(self, *texts: str) -> None:
        self.texts = list(texts)
        self.users: list[str] = []

    async def structured(
        self, *, system: str, user: str, schema: dict[str, Any], purpose: str
    ) -> ModelCall:
        self.users.append(user)
        return ModelCall(
            text=self.texts.pop(0),
            model="m",
            input_tokens=10,
            output_tokens=5,
            cost_usd=0,
            latency_ms=1,
        )


def test_validate_test_rules() -> None:
    assert validate_test(GOOD_TEST) == []
    assert "does not import from vitest" in validate_test("it('x', () => {})")
    assert any("network" in p for p in validate_test(GOOD_TEST + "fetch('https://x')"))


def test_validate_patch_rules() -> None:
    ok = PatchOut.model_validate(
        {
            "edits": [
                {
                    "path": "api/src/services/checkout.ts",
                    "find": "this.promotions.get(code ?? '')",
                    "replace": "this.promotions.get(code)",
                }
            ],
            "explanation": "x",
        }
    )
    assert validate_patch(ok, CTX) == []
    bad = PatchOut.model_validate(
        {"edits": [{"path": "api/package.json", "find": "a", "replace": "b"}], "explanation": "x"}
    )
    assert validate_patch(bad, CTX) == ["api/package.json is not an editable file"]


async def test_generate_test_retries_when_rules_are_broken() -> None:
    bad = json.dumps({"content": "it('x', () => { fetch('https://evil') })", "rationale": "r"})
    good = json.dumps({"content": GOOD_TEST, "rationale": "fails until coupons are optional"})
    fake = Fake(bad, good)
    out, problem, usage = await generate_test(CTX, fake, "reproduce_v1")
    assert out is not None and problem is None and usage["calls"] == 2
    assert "previous answer was rejected" in fake.users[1]
    assert '<existing_test path="api/test/checkout.test.ts">' in fake.users[0]


async def test_generate_patch_gives_up_after_two_invalid_answers() -> None:
    bad = json.dumps({"edits": [{"path": "x.ts", "find": "a", "replace": "b"}], "explanation": "e"})
    out, problem, _ = await generate_patch(
        CTX,
        {"path": CTX.testPath, "content": GOOD_TEST},
        "FAIL",
        "previous: still failing",
        Fake(bad, bad),
        "patch_v1",
    )
    assert out is None and problem is not None and "not an editable file" in problem


def test_patch_schema_is_closed() -> None:
    assert PATCH_SCHEMA["additionalProperties"] is False
    assert PATCH_SCHEMA["properties"]["edits"]["items"]["required"] == ["path", "find", "replace"]
