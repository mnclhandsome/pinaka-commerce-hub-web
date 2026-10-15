import AddDevice from "./AddDevice";

/** Merchant-scoped version of the standard device registration form. */
export default function AddMerchantDevice({ merchantId, merchant, onBack, onSave }) {
  return (
    <AddDevice
      merchantId={merchantId}
      merchant={merchant}
      embedded
      onSave={onSave}
      onCancel={onBack}
    />
  );
}
