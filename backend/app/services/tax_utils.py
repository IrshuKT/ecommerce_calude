from decimal import Decimal

def calc_line_tax(line_total: Decimal, gst_rate: Decimal) -> tuple[Decimal, Decimal]:
    """retail_price/line_total is tax-inclusive. Back-calculates the
    taxable value and tax portion. Returns (taxable_value, tax_amount)."""
    rate = gst_rate / Decimal("100")
    taxable_value = (line_total / (1 + rate)).quantize(Decimal("0.01"))
    tax_amount = line_total - taxable_value
    return taxable_value, tax_amount