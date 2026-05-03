-- Trigger to auto-format receipt_no
DROP TRIGGER IF EXISTS trg_set_receipt_no ON public.receipts;
CREATE TRIGGER trg_set_receipt_no
BEFORE INSERT ON public.receipts
FOR EACH ROW
EXECUTE FUNCTION public.set_receipt_no();

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_funds_updated_at ON public.funds;
CREATE TRIGGER trg_funds_updated_at BEFORE UPDATE ON public.funds
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_members_updated_at ON public.members;
CREATE TRIGGER trg_members_updated_at BEFORE UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger handle_new_user on auth.users (in case missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();