# notus.is — Quantum Hardware Activation Guide

> **Phase-F** | Last updated: 2026-06-23

---

## Overview

notus.is uses a **Variational Quantum Eigensolver (VQE)** to compute binding affinity proxies for drug candidates. The quantum score is a value in [0, 1] that is combined with the classical ML ensemble pIC50 prediction:

```
pic50_vqe = base_pic50 × (1 + 0.1 × quantum_score)
```

Three quantum backends are supported with a weighted ensemble:

| Backend | Weight | Provider | Hardware |
|---|---|---|---|
| WuKong | 50% | Origin Quantum Cloud | 180-qubit superconducting chip |
| Quafu | 30% | BAQIS | ScQ superconducting chip |
| Jiuzhang | 20% | USTC | Photonic (proxy via WuKong until API is public) |

All backends fall back to a classical CPU heuristic (`angleBasedFallback`) if the API is unreachable or the key is missing. The provenance field records which path was taken:

| Provenance | Meaning |
|---|---|
| `QUANTUM_DUAL` | Two or more real/sim quantum backends responded |
| `QUANTUM_SIM` | One quantum backend responded (real HW or free simulator) |
| `CLASSICAL` | All backends fell back to CPU heuristic |

---

## WuKong (Origin Quantum Cloud)

### 1. Create an account

Register at [qcloud.originqc.com.cn](https://qcloud.originqc.com.cn).

### 2. Obtain an API token

In the Origin Quantum Cloud dashboard, navigate to **API Keys** and generate a new token. Copy the token value.

### 3. Set environment variables

```bash
# .env
WUKONG_API_TOKEN=your_token_here
WUKONG_BACKEND=full_amplitude   # free simulator (default)
```

### 4. Backend options

| Value | Description | Cost |
|---|---|---|
| `full_amplitude` | Free cloud simulator — exact quantum state, up to 25 qubits | Free |
| `WK_C180_2` | Real 180-qubit WuKong hardware | QPU credits required |
| `auto` | Prefer `WK_C180_2` if available, else `full_amplitude` | Varies |

### 5. Install pyqpanda3

```bash
pip3 install pyqpanda3
```

### 6. Verify

```bash
python3 server/discovery/wukong_vqe.py "CC(=O)Nc1ccc(O)cc1" "$WUKONG_API_TOKEN" full_amplitude
```

Expected output:

```json
{"score": 0.724, "backend": "full_amplitude", "n_qubits": 4}
```

---

## Quafu (BAQIS ScQ Hardware)

### 1. Create an account

Register at [quafu.baqis.ac.cn](https://quafu.baqis.ac.cn).

### 2. Obtain an API key

In the Quafu dashboard, navigate to **User Center → API Key** and copy your key.

### 3. Set environment variables

```bash
# .env
QUAFU_API_KEY=your_key_here
QUAFU_API_URL=https://quafu.baqis.ac.cn/qbackend/scq_u3cx   # default
```

### 4. Verify

The Quafu backend is called automatically when `QUAFU_API_KEY` is set. Check the server logs for:

```
[Quantum] WuKong VQE score=0.724 backend=full_amplitude qubits=4
[Quantum] Quafu score=0.698
```

---

## Jiuzhang (USTC Photonic)

The Jiuzhang 4.0 API is not yet publicly accessible. Until the API is released, Jiuzhang scores are proxied from the WuKong result. No configuration is required.

When the Jiuzhang API becomes available, set:

```bash
JIUZHANG_API_KEY=your_key_here
JIUZHANG_API_URL=https://jiuzhang.ustc.edu.cn/api/vqe   # placeholder
```

---

## VQE Circuit Design

The VQE circuit in `server/discovery/wukong_vqe.py` encodes molecular features as rotation angles on a 4-qubit ansatz:

```
SMILES → RDKit fingerprint (2048 bits) → 4 angle features
  θ₀ = MW / 500 × π
  θ₁ = logP / 5 × π
  θ₂ = HBD / 5 × π
  θ₃ = HBA / 10 × π

Circuit: Ry(θ₀) Ry(θ₁) Ry(θ₂) Ry(θ₃) + CNOT entanglement layer
Measurement: expectation value of Z⊗Z⊗Z⊗Z → score ∈ [0, 1]
```

The circuit uses the **hardware-efficient ansatz** (HEA) with one layer of single-qubit rotations and one layer of CNOT gates. This is compatible with both the `full_amplitude` simulator and the `WK_C180_2` hardware backend.

---

## Quantum Score Contribution

The quantum score contributes a maximum of **+10%** to the base pIC50:

```
quantum_score = 1.0  →  pic50_vqe = base_pic50 × 1.10  (+10%)
quantum_score = 0.5  →  pic50_vqe = base_pic50 × 1.05  (+5%)
quantum_score = 0.0  →  pic50_vqe = base_pic50 × 1.00  (no change)
```

This conservative weighting ensures that classical ML predictions remain the primary signal while quantum hardware provides a meaningful refinement for high-confidence candidates.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `[Quantum] wukong_vqe parse error` | pyqpanda3 not installed | `pip3 install pyqpanda3` |
| `[Quantum] wukong_vqe fallback (classical_fallback)` | Invalid API token | Check `WUKONG_API_TOKEN` in `.env` |
| `[Quantum] Quafu failed` | Network or key error | Check `QUAFU_API_KEY` and `QUAFU_API_URL` |
| Score always `CLASSICAL` | Both keys missing | Set at least `WUKONG_API_TOKEN` |
| `WK_C180_2` unavailable | QPU queue full | Use `WUKONG_BACKEND=auto` to fall back to simulator |
| Timeout after 360s | Large molecule or slow queue | Normal for real hardware; simulator is ~5s |

---

## Quantum Credits

Origin Quantum Cloud charges QPU credits for `WK_C180_2` jobs. Each VQE circuit submission costs approximately 1–5 credits depending on circuit depth and shot count. The `full_amplitude` simulator is free.

notus.is submits one VQE circuit per candidate per cycle. With 10 candidates per cycle and 18 cycles per day, real hardware usage is approximately **180 circuits/day**.

For cost control, use `WUKONG_BACKEND=full_amplitude` during development and `WUKONG_BACKEND=auto` in production to use real hardware only when available.
