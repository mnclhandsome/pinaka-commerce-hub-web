import assert from "node:assert/strict";
import test from "node:test";
import { buildDiscountPayload, catalogProductId, storedProductId, validateDiscountForm } from "./discountForm.js";

const base = {
  code: "Weekend special",
  amount: "15",
  product: "17274",
  discounted_products: "",
  auto_apply: true,
  qty: "",
  usage_limit: "5",
  minimum_amount: "10",
  maximum_amount: "40",
  min_qty: "1",
  max_qty: "4",
  date_starts: "2026-10-18",
  date_expires: "2026-10-21",
};

test("Grok Bot: auto discount create payload uses the product id and WooCommerce yes flag", () => {
  const form = { ...base, type: "auto", discount_type: "fixed_cart" };
  assert.deepEqual(validateDiscountForm(form), { ok: true });
  assert.deepEqual(buildDiscountPayload(form), {
    type: "auto",
    code: "Weekend special",
    discount_type: "fixed_cart",
    amount: 15,
    product_id: 17274,
    pinaka_discount_auto_apply: "yes",
    usage_limit: 5,
    minimum_amount: 10,
    maximum_amount: 40,
    min_qty: 1,
    max_qty: 4,
    date_starts: "2026-10-18",
    date_expires: "2026-10-21",
  });
});

test("Grok Bot: mix and match create sends the trigger product and discounted products separately", () => {
  const form = {
    ...base,
    type: "mix_match",
    discount_type: "fixed_item",
    amount: "2",
    auto_apply: false,
    discounted_products: "17284,17270",
    minimum_amount: "",
    maximum_amount: "",
    min_qty: "",
    max_qty: "",
    usage_limit: "",
  };
  assert.deepEqual(buildDiscountPayload(form), {
    type: "mix_match",
    code: "Weekend special",
    discount_type: "fixed_item",
    amount: 2,
    product_id: 17274,
    pinaka_discount_auto_apply: "no",
    discount_product_ids: [17284, 17270],
    required_product_ids: [17274],
    date_starts: "2026-10-18",
    date_expires: "2026-10-21",
  });
  assert.equal(validateDiscountForm({ ...form, discounted_products: "17274" }).message, "The trigger product cannot also be a discounted product.");
});

test("Grok Bot: multipack create requires a whole pack quantity and keeps the discount name", () => {
  const form = {
    ...base,
    type: "multipack",
    discount_type: "percent",
    amount: "10",
    qty: "3",
    minimum_amount: "",
    maximum_amount: "",
    min_qty: "",
    max_qty: "",
  };
  assert.equal(validateDiscountForm({ ...form, qty: "2.5" }).tab, "rules");
  assert.equal(buildDiscountPayload(form).code, "Weekend special");
  assert.equal(buildDiscountPayload(form).qty, 3);
  assert.equal(buildDiscountPayload(form).product_id, 17274);
});

test("Grok Bot: product picker and edit form use the WooCommerce product id", () => {
  assert.equal(catalogProductId({ wordpressId: "", id: 64290, name: "Sketch book" }), "64290");
  assert.equal(catalogProductId({ id: "4f3f0b1d-2957-43db-a7a1-fc1243daa2a7", payload: { id: 42938 } }), "42938");
  assert.equal(storedProductId({ product: "tissue", product_id: 17274 }), "17274");
  assert.equal(validateDiscountForm({ ...base, type: "auto", discount_type: "percent", product: "tissue" }).message, "Select a product.");
});

test("Grok Bot: schedule and spend limits are rejected before create", () => {
  assert.equal(validateDiscountForm({ ...base, type: "auto", discount_type: "percent", amount: "150" }).message, "Enter an amount greater than 0 and no more than 100%.");
  assert.equal(validateDiscountForm({ ...base, type: "auto", discount_type: "percent", date_expires: "2026-10-01" }).tab, "limits");
  assert.equal(validateDiscountForm({ ...base, type: "auto", discount_type: "percent", minimum_amount: "50", maximum_amount: "10" }).tab, "rules");
});
