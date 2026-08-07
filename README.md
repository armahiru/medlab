# MediChain (Mini Project)

**Simulated Blockchain-Based Medical Report Management and Distribution System**

## One-sentence summary

Medical reports are sealed as SHA-256 hash-linked blocks on a single-node ledger so unauthorized changes can be detected during integrity checks and public verification.

## Is this “real blockchain”?

| Real blockchain | This mini project |
|---|---|
| Many nodes / consensus | One Node.js server + MongoDB |
| Mining / coins | Not used (`nonce` always 0) |
| Hash-linked blocks | **Yes — core feature** |
| Tamper detection | **Yes — demo + verify** |

**Say in viva:** *“It is a simulated blockchain focusing on integrity of medical reports, not cryptocurrency networking.”*

## Core blockchain flow

1. Doctor uploads report → file SHA-256 hashed  
2. Metadata + file hash stored as block `data`  
3. Block stores `hash` + `previousHash`  
4. Admin integrity check recalculates hashes  
5. Tamper simulation edits data without updating hash → detected  

## Run

```bash
npm install
npm run backend    # http://localhost:5000
npm run frontend   # http://localhost:3000
```

Open: http://localhost:3000/index.html

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@hospital.org` | `admin123` |
| Doctor | `doctor@hospital.org` | `doctor123` |
| Patient | `patient@hospital.org` | `patient123` |

Demo Patient ID: **`PAT-2026-0142`**

## 2-minute marking demo

1. Doctor login → upload report with `PAT-2026-0142` → copy Report ID  
2. Public Verify → Authentic  
3. Admin → Integrity Check → Valid  
4. Simulate Tamper → Integrity Check → Tampered  
5. Verify again → fails  

## What is on-chain vs off-chain

| On simulated chain | Off-chain (normal DB) |
|---|---|
| Medical report blocks | Appointments |
| File hash + block hash | Contact messages |
| Integrity / verify | In-app notifications |

## Stack

HTML/CSS/JS · Node.js/Express · MongoDB · JWT · SHA-256 (`crypto`)

## Known limitations (honest)

- Single-node simulation  
- Demo passwords for marking only  
- Not HIPAA / not production EHR  
