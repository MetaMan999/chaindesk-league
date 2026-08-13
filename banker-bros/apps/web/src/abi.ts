export const registryAbi = [
  {
    type: "function",
    name: "registerBroker",
    stateMutability: "nonpayable",
    inputs: [
      { name: "brokerId", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "brokers",
    stateMutability: "view",
    inputs: [{ name: "brokerId", type: "uint256" }],
    outputs: [
      { name: "account", type: "address" },
      { name: "registeredAt", type: "uint64" },
      { name: "seasonJoined", type: "uint32" },
      { name: "active", type: "bool" },
    ],
  },
] as const;

export const collectionAbi = [
  {
    type: "function",
    name: "totalMinted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "mintPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint96" }],
  },
  {
    type: "function",
    name: "salePhase",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [
      { name: "quantity", type: "uint16" },
      { name: "allowance", type: "uint16" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
] as const;

export const accountFactoryAbi = [
  {
    type: "function",
    name: "createAccount",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "account", type: "address" }],
  },
  {
    type: "function",
    name: "predictAccount",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "predicted", type: "address" }],
  },
] as const;
