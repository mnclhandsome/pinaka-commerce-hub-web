export function catalogProductId(product) {
  const candidates = [product?.wordpressId, product?.wordpress_id, product?.payload?.id, product?.id];
  for (const candidate of candidates) {
    const id = Number(candidate);
    if (String(candidate ?? "").trim() !== "" && Number.isInteger(id) && id > 0) return String(id);
  }
  return "";
}

export function storedProductId(discount) {
  return catalogProductId({
    id: discount?.product_id ?? discount?.main_product_id,
  });
}

export function validateDiscountForm(form) {
  if (!form?.type) return { tab: "details", message: "Select a discount type." };
  if (!String(form.code || "").trim() || !form.discount_type || form.amount === "" || form.amount == null) {
    return { tab: "details", message: "Discount name, discount type, and amount are required." };
  }
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0 || (form.discount_type === "percent" && amount > 100)) {
    return {
      tab: "details",
      message: form.discount_type === "percent"
        ? "Enter an amount greater than 0 and no more than 100%."
        : "Enter a valid discount amount greater than 0.",
    };
  }
  const productId = Number(form.product);
  if (!Number.isInteger(productId) || productId <= 0) {
    return {
      tab: "rules",
      message: form.type === "mix_match" ? "Choose a main trigger product." : "Select a product.",
    };
  }
  const discountedIds = productIdList(form.discounted_products);
  if (form.type === "mix_match" && !discountedIds.length) {
    return { tab: "rules", message: "Select at least one discounted product." };
  }
  if (form.type === "mix_match" && discountedIds.includes(productId)) {
    return { tab: "rules", message: "The trigger product cannot also be a discounted product." };
  }
  const quantity = Number(form.qty);
  if (form.type === "multipack" && (!Number.isInteger(quantity) || quantity < 1)) {
    return { tab: "rules", message: "Pack quantity must be a whole number of at least 1." };
  }
  if (form.minimum_amount !== "" && form.maximum_amount !== "" && Number(form.minimum_amount) > Number(form.maximum_amount)) {
    return { tab: "rules", message: "Maximum spend must be greater than or equal to minimum spend." };
  }
  if (form.min_qty !== "" && form.max_qty !== "" && Number(form.min_qty) > Number(form.max_qty)) {
    return { tab: "limits", message: "Maximum quantity must be greater than or equal to minimum quantity." };
  }
  if (form.date_starts && form.date_expires && form.date_starts > form.date_expires) {
    return { tab: "limits", message: "Expiry date must be on or after the start date." };
  }
  return { ok: true };
}

export function buildDiscountPayload(form) {
  const productId = Number(form.product);
  const discountedIds = productIdList(form.discounted_products);
  const payload = {
    type: form.type,
    code: String(form.code).trim(),
    discount_type: form.discount_type,
    amount: Number(form.amount),
    product_id: productId,
    pinaka_discount_auto_apply: form.auto_apply ? "yes" : "no",
  };
  if (form.type === "mix_match") {
    payload.discount_product_ids = discountedIds;
    payload.required_product_ids = [productId];
  }
  for (const key of ["qty", "usage_limit", "minimum_amount", "maximum_amount", "min_qty", "max_qty"]) {
    if (form[key] !== "" && form[key] != null) payload[key] = Number(form[key]);
  }
  if (form.date_starts) payload.date_starts = form.date_starts;
  if (form.date_expires) payload.date_expires = form.date_expires;
  return payload;
}

function productIdList(value) {
  return String(value || "")
    .split(",")
    .map(item => Number(item.trim()))
    .filter(id => Number.isInteger(id) && id > 0);
}
