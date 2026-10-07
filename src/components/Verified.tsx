import Icon from "./Icon";

/** Small verified tick that sits after a business name. Carries its own accessible name. */
export default function Verified() {
  return (
    <span title="Verified Incubation Hub member" className="ml-1 inline-flex align-middle text-royal">
      <Icon name="check-circle" size="sm" label="Verified" />
    </span>
  );
}
