# Epozy App — Indian Glass E-Commerce

FastAPI backend + Next.js frontend for Indian glass materials store.

## Quick Start (Backend)

```bash
cd backend
python -m venv venv
source venv/Scripts/activate   # Git Bash on Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your DB credentials
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000/api/docs

## Stack
- Backend: FastAPI + PostgreSQL + Alembic
- Frontend: Next.js + TailwindCSS (coming next)
- Payments: Razorpay (UPI + COD)
- GST: Auto CGST/SGST/IGST based on state
