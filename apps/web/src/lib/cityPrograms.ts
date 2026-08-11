import type { ChainHookName } from "./chainHooks";

export type CityLocation = "STREET" | "EXCHANGE" | "BANK" | "BROKERAGE" | "COFFEE" | "SUBWAY" | "OTC";

export type CityCareerState = {
  energy: number;
  shiftXp: number;
  job: string;
  completedAt: Record<string, number>;
};

export type CityProgram = {
  id: string;
  label: string;
  location: CityLocation;
  description: string;
  energyDelta: number;
  shiftXp: number;
  reputation: number;
  commission: number;
  aum: number;
  cooldownMs: number;
  hook?: ChainHookName;
};

export type ProgramResult = {
  state: CityCareerState;
  program: CityProgram;
  allowed: boolean;
  message: string;
};

export const CITY_CAREER_KEY = "banker-bros-city-career-v1";

export const cityPrograms: CityProgram[] = [
  { id: "clock-in", label: "Clock in for the bell", location: "EXCHANGE", description: "Start a floor-broker shift and open the simulated tape.", energyDelta: 0, shiftXp: 5, reputation: 1, commission: 0, aum: 0, cooldownMs: 30_000, hook: "BrokerRegistry" },
  { id: "service-flow", label: "Service test order flow", location: "EXCHANGE", description: "Work the routing rail and keep the fictional market orderly.", energyDelta: -12, shiftXp: 18, reputation: 3, commission: 45, aum: 0, cooldownMs: 45_000, hook: "BrokerRouter" },
  { id: "client-meeting", label: "Pitch a client mandate", location: "BANK", description: "Meet a fictional client and explain liquidity, risk, and drawdown.", energyDelta: -10, shiftXp: 16, reputation: 5, commission: 60, aum: 5_000, cooldownMs: 60_000, hook: "BrokerVault" },
  { id: "desk-work", label: "Run the brokerage desk", location: "BROKERAGE", description: "Reconcile the book, call clients, and improve desk operations.", energyDelta: -9, shiftXp: 14, reputation: 3, commission: 55, aum: 1_000, cooldownMs: 45_000, hook: "BankerHook" },
  { id: "research", label: "Write a market brief", location: "BROKERAGE", description: "Study the fictional tape and prepare a client-safe research note.", energyDelta: -7, shiftXp: 12, reputation: 4, commission: 25, aum: 0, cooldownMs: 40_000 },
  { id: "coffee", label: "Take a coffee break", location: "COFFEE", description: "Recover energy and listen for harmless district rumors.", energyDelta: 28, shiftXp: 2, reputation: 0, commission: 0, aum: 0, cooldownMs: 90_000 },
  { id: "subway", label: "Check the district board", location: "SUBWAY", description: "Review future fast-travel routes and expansion districts.", energyDelta: -1, shiftXp: 1, reputation: 1, commission: 0, aum: 0, cooldownMs: 20_000 },
  { id: "otc-sim", label: "Negotiate a test OTC block", location: "OTC", description: "Practice a non-custodial negotiation using fictional/test labels only.", energyDelta: -14, shiftXp: 20, reputation: 4, commission: 70, aum: 0, cooldownMs: 75_000, hook: "BrokerRouter" },
];

export function createCityCareer(): CityCareerState {
  return { energy: 100, shiftXp: 0, job: "ROOKIE BROKER", completedAt: {} };
}

export function programsForLocation(location: CityLocation) {
  return cityPrograms.filter((program) => program.location === location);
}

export function runCityProgram(programId: string, state: CityCareerState, now: number): ProgramResult {
  const program = cityPrograms.find((item) => item.id === programId);
  if (!program) throw new Error(`Unknown city program: ${programId}`);
  const lastCompleted = state.completedAt[program.id] ?? 0;
  const remaining = lastCompleted + program.cooldownMs - now;
  if (remaining > 0) {
    return { state, program, allowed: false, message: `${program.label} is ready again in ${Math.ceil(remaining / 1_000)}s.` };
  }
  if (program.energyDelta < 0 && state.energy < Math.abs(program.energyDelta)) {
    return { state, program, allowed: false, message: "Not enough energy. Visit Bull & Bean before taking another shift." };
  }
  const nextEnergy = Math.max(0, Math.min(100, state.energy + program.energyDelta));
  return {
    program,
    allowed: true,
    message: `${program.label} complete · +${program.shiftXp} job XP`,
    state: {
      energy: nextEnergy,
      shiftXp: state.shiftXp + program.shiftXp,
      job: program.id === "clock-in" ? "FLOOR BROKER" : state.job,
      completedAt: { ...state.completedAt, [program.id]: now },
    },
  };
}

export function careerLevel(shiftXp: number) {
  return Math.max(1, Math.min(20, 1 + Math.floor(Math.max(0, shiftXp) / 100)));
}
