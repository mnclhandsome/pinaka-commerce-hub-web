import { useAuth } from "../auth/AuthContext";

export default function Can({ resource, action = "view", children }) {
  const { can } = useAuth();
  if (!can(resource, action)) return null;
  return children;
}

export function useActionAllowed(resource, editing) {
  const { can } = useAuth();
  return editing ? can(resource, "update") : can(resource, "create");
}
