# Decentralized Voting Architecture (Simulation + Optional Blockchain)

This repo contains a lightweight voting **simulation frontend** that lets you:
- Add candidates
- Vote for one candidate
- See vote counts update instantly

Nothing is stored (no database, no on-chain writes) — it’s meant for quick demos.

There is also an **optional blockchain mode** preserved in the codebase for the original Truffle/Web3 contract flow.

## Quick Start (Simulation Mode)

### Requirements
- Node.js 18+
- (Optional) MetaMask extension (for the “Connect Wallet” popup)

### Run

```bash
npm install
npm run build
node index.js
```

Open:
- http://localhost:8080/ (default = simulation)

## Modes

- **Simulation mode (default):** `http://localhost:8080/?mode=sim`
  - In-memory only (refresh resets)
  - MetaMask connect is optional and does not submit transactions

- **Blockchain mode:** `http://localhost:8080/?mode=chain`
  - Uses the existing Web3/Truffle contract UI flow
  - Requires a local chain (Ganache) + contract migration + (typically) MetaMask

## Optional: Run Blockchain Mode

If you want the original on-chain behavior:

```bash
# terminal 1: start local chain
npm run chain

# terminal 2: deploy contracts
npm run migrate

# terminal 3: start server
npm run build
node index.js
```

Then open:
- http://localhost:8080/?mode=chain

## Notes

- Secrets are intentionally not committed. Use `.env.example` and `Database_API/.env.example` as templates.

## License

MIT
