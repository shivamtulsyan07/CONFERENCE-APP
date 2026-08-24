import { createContext, useContext, useState } from "react";

const RoleContext = createContext({ role: "staff", setRole: () => {} });

export const RoleProvider = ({ children }) => {
  const [role, setRole] = useState(localStorage.getItem("role") || "staff");
  const update = (r) => {
    setRole(r);
    localStorage.setItem("role", r);
  };
  return (
    <RoleContext.Provider value={{ role, setRole: update, isAdmin: role === "admin" }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);
