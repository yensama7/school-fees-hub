import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, type Student } from "@/lib/studentData";
import { Plus, Trash2, GraduationCap, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const STUDENT_LOOKUP_URL =
  "https://beta-test1.app.n8n.cloud/webhook/bea95683-07e0-45b1-a69d-d33171fb34e9";

const OPTIONAL_FEES_URL =
  "https://beta-test1.app.n8n.cloud/webhook/34b4adf9-6386-44df-99e6-720a7c3d4596";

interface OptionalFee {
  id: number;
  fee_name: string;
  amount: number;
  category: string;
}

export function SchoolFeesForm() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [studentIds, setStudentIds] = useState<string[]>([""]);
  const [resolved, setResolved] = useState<Record<number, Student | null>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [optionalFees, setOptionalFees] = useState<OptionalFee[]>([]);
  // selectedOptional[index] = Set of fee ids selected for that student
  const [selectedOptional, setSelectedOptional] = useState<
    Record<number, Set<number>>
  >({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(OPTIONAL_FEES_URL, { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        const list: OptionalFee[] = (Array.isArray(data) ? data : []).map(
          (r: Record<string, unknown>) => ({
            id: Number(r.id),
            fee_name: String(r.fee_name),
            amount: Number(r.amount),
            category: String(r.category),
          })
        );
        if (!cancelled) setOptionalFees(list);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleOptional = (index: number, feeId: number) => {
    setSelectedOptional((prev) => {
      const current = new Set(prev[index] ?? []);
      if (current.has(feeId)) current.delete(feeId);
      else current.add(feeId);
      return { ...prev, [index]: current };
    });
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value.trim() && !EMAIL_REGEX.test(value.trim())) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  const handleStudentIdChange = (index: number, value: string) => {
    const upper = value.toUpperCase();
    const updated = [...studentIds];
    updated[index] = upper;
    setStudentIds(updated);
    // Clear previous result when editing
    if (resolved[index] !== undefined) {
      setResolved((prev) => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
    }
  };

  const checkStudent = async (index: number) => {
    const id = studentIds[index]?.trim();
    if (!id) {
      toast.error("Please enter a student ID first.");
      return;
    }
    setLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const res = await fetch(STUDENT_LOOKUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: id }),
      });
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json();
      const record = Array.isArray(data) ? data[0] : data;
      if (record && record.Name) {
        const student: Student = {
          id: record["Reg Number"] || id,
          name: record.Name,
          grade: record.Class,
          fees: Number(record.fees),
        };
        setResolved((prev) => ({ ...prev, [index]: student }));
      } else {
        setResolved((prev) => ({ ...prev, [index]: null }));
      }
    } catch {
      setResolved((prev) => ({ ...prev, [index]: null }));
    } finally {
      setLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  const addStudentField = () => {
    setStudentIds([...studentIds, ""]);
  };

  const removeStudentField = (index: number) => {
    if (studentIds.length === 1) return;
    setStudentIds(studentIds.filter((_, i) => i !== index));
    setResolved((prev) => {
      const copy = { ...prev };
      delete copy[index];
      const reindexed: Record<number, Student | null> = {};
      Object.entries(copy).forEach(([k, v]) => {
        const key = Number(k);
        reindexed[key > index ? key - 1 : key] = v;
      });
      return reindexed;
    });
    setSelectedOptional((prev) => {
      const copy = { ...prev };
      delete copy[index];
      const reindexed: Record<number, Set<number>> = {};
      Object.entries(copy).forEach(([k, v]) => {
        const key = Number(k);
        reindexed[key > index ? key - 1 : key] = v;
      });
      return reindexed;
    });
  };

  const resolvedStudents = Object.values(resolved).filter(
    (s): s is Student => s !== null
  );
  const baseTotal = resolvedStudents.reduce((sum, s) => sum + s.fees, 0);
  const optionalTotal = Object.entries(selectedOptional).reduce(
    (sum, [idx, ids]) => {
      if (!resolved[Number(idx)]) return sum;
      let s = sum;
      ids.forEach((id) => {
        const fee = optionalFees.find((f) => f.id === id);
        if (fee) s += fee.amount;
      });
      return s;
    },
    0
  );
  const total = baseTotal + optionalTotal;

  const canPay =
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    !emailError &&
    EMAIL_REGEX.test(email.trim()) &&
    resolvedStudents.length > 0;

  const handlePay = () => {
    if (!canPay) return;

    if (!window.PaystackPop) {
      toast.error("Payment system is still loading. Please try again.");
      return;
    }

    try {
      const handler = window.PaystackPop.setup({
        key: "pk_test_513f13a049085892c9481db297e58d15e9743a02",
        email: email.trim(),
        amount: total * 100,
        currency: "NGN",
        metadata: {
          custom_fields: [
            {
              display_name: "Parent Name",
              variable_name: "parent_name",
              value: `${firstName.trim()} ${lastName.trim()}`,
            },
            {
              display_name: "Students",
              variable_name: "student_ids",
              value: resolvedStudents.map((s) => s.name).join(", "),
            },
          ],
        },
        callback: (response: { reference: string }) => {
          const webhookPayload = {
            parent_first_name: firstName.trim(),
            parent_last_name: lastName.trim(),
            gmail: email.trim(),
            children: Object.entries(resolved)
              .filter(([, s]) => s !== null)
              .map(([idx, s]) => {
                const ids = selectedOptional[Number(idx)] ?? new Set<number>();
                const extras = optionalFees
                  .filter((f) => ids.has(f.id))
                  .map((f) => ({
                    fee_name: f.fee_name,
                    amount: f.amount,
                    category: f.category,
                  }));
                return {
                  name: (s as Student).name,
                  base_fee: (s as Student).fees,
                  optional_fees: extras,
                };
              }),
            total_amount: total,
            transaction_reference: response.reference,
          };

          fetch(
            "https://beta-test1.app.n8n.cloud/webhook-test/7e4c1dea-18cc-44ef-ab4b-fd010371ede5",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(webhookPayload),
              keepalive: true,
            }
          )
            .then(() => toast.success("Receipt sent to your email."))
            .catch(() => toast.error("Failed to send receipt."));

          navigate("/payment-success");
        },
        onClose: () => {
          toast.info("Payment window closed.");
        },
      });

      handler.openIframe();
    } catch (err) {
      toast.error("Failed to open payment. Please try again or open in a new tab.");
      console.error("Paystack error:", err);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-6">
      {/* Parent Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Parent's First Name</Label>
          <Input
            id="firstName"
            placeholder="e.g. Chinedu"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Parent's Last Name</Label>
          <Input
            id="lastName"
            placeholder="e.g. Adeyemi"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="e.g. parent@example.com"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          className={emailError ? "border-destructive" : ""}
        />
        {emailError && (
          <p className="text-sm text-destructive">{emailError}</p>
        )}
      </div>

      {/* Student IDs */}
      <div className="space-y-3">
        <Label>Student ID(s)</Label>
        {studentIds.map((sid, index) => (
          <div key={index} className="space-y-1">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="e.g. STD001"
                value={sid}
                onChange={(e) => handleStudentIdChange(index, e.target.value)}
                className="uppercase"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={loading[index] || !sid.trim()}
                onClick={() => checkStudent(index)}
              >
                {loading[index] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-1" />
                    Check
                  </>
                )}
              </Button>
              {studentIds.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeStudentField(index)}
                  aria-label="Remove student"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
            {/* Resolved student info */}
            {resolved[index] !== undefined && (
              <>
                <div
                  className={`text-sm rounded-lg px-3 py-2 flex items-center gap-2 ${
                    resolved[index]
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {resolved[index] ? (
                    <>
                      <GraduationCap className="h-4 w-4 shrink-0" />
                      <span className="font-medium">{resolved[index]!.name}</span>
                      <span className="text-muted-foreground">
                        — {resolved[index]!.grade}
                      </span>
                      <span className="ml-auto font-semibold">
                        {formatCurrency(resolved[index]!.fees)}
                      </span>
                    </>
                  ) : (
                    <span>Student not found</span>
                  )}
                </div>
                {resolved[index] && optionalFees.length > 0 && (
                  <div className="mt-2 ml-1 space-y-2 border-l-2 border-border pl-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Optional Payments
                    </p>
                    {optionalFees.map((fee) => {
                      const checked =
                        selectedOptional[index]?.has(fee.id) ?? false;
                      const cbId = `opt-${index}-${fee.id}`;
                      return (
                        <div
                          key={fee.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            id={cbId}
                            checked={checked}
                            onCheckedChange={() =>
                              toggleOptional(index, fee.id)
                            }
                          />
                          <Label
                            htmlFor={cbId}
                            className="font-normal cursor-pointer flex-1 flex items-center justify-between"
                          >
                            <span>
                              {fee.fee_name}
                              <span className="text-muted-foreground ml-1">
                                ({fee.category})
                              </span>
                            </span>
                            <span className="font-medium">
                              {formatCurrency(fee.amount)}
                            </span>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addStudentField}
          className="mt-1"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add another student
        </Button>
      </div>

      {/* Total */}
      {resolvedStudents.length > 0 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-muted-foreground font-medium">Total Fees</span>
          <span className="text-2xl font-bold text-foreground">
            {formatCurrency(total)}
          </span>
        </div>
      )}

      {/* Pay Button */}
      <Button
        variant="pay"
        size="lg"
        className="w-full"
        disabled={!canPay}
        onClick={handlePay}
      >
        Pay Fees
      </Button>
    </div>
  );
}
