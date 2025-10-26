\"use client\";

import { PropsWithChildren, createContext, useContext } from \"react\";
import { useBets } from \"../hooks\";

type BetsContextValue = ReturnType<typeof useBets>;

const BetsContext = createContext<BetsContextValue | null>(null);

export const BetsProvider = ({ children }: PropsWithChildren) => {
  const value = useBets();
  return <BetsContext.Provider value={value}>{children}</BetsContext.Provider>;
};

export const useBetsContext = () => {
  const ctx = useContext(BetsContext);
  if (!ctx) {
    throw new Error(\"useBetsContext must be used within BetsProvider\");
  }
  return ctx;
};
