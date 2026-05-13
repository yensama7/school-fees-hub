import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, type Student } from "@/lib/studentData";
import { GraduationCap, Loader2, Search, Trash2, Plus } from "lucide-react";
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

const STUDENT_BY_ID_URL =
  "https://beta-test1.app.n8n.cloud/webhook/c0320dc7-d639-40df-b5af-27d0babec959";

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
  const [familyId, setFamilyId] = useState("");
  const [resolved, setResolved] = useState<Record<number, Student | null>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [optionalFees, setOptionalFees] = useState<OptionalFee[]>([]);
  // selectedOptional[index] = Set of fee ids selected for that student
  const [selectedOptional, setSelectedOptional] = useState<
    Record<number, Set<number>>
  >({});
  const [extraStudentId, setExtraStudentId] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);

  const fetchOptionalFees = async () => {
    if (optionalFees.length > 0) return;
    try {
      const res = await fetch(OPTIONAL_FEES_URL, { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      const list: OptionalFee[] = arr.map(
        (r: Record<string, unknown>) => ({
          id: Number(r.id),
          fee_name: String(r.fee_name),
          amount: Number(r.amount),
          category: String(r.category),
        })
      );
      setOptionalFees(list);
    } catch {
      /* silent */
    }
  };

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

  const handleFamilyIdChange = (value: string) => {
    setFamilyId(value.toUpperCase());
    if (searched) {
      setSearched(false);
      setResolved({});
      setSelectedOptional({});
      setExtraStudentId("");
    }
  };

  const removeStudent = (index: number) => {
    setResolved((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setSelectedOptional((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const addStudentById = async () => {
    const sid = extraStudentId.trim().toUpperCase();
    const fid = familyId.trim();
    if (!sid) {
      toast.error("Please enter a student ID.");
      return;
    }
    if (!fid) {
      toast.error("Please search by family ID first.");
      return;
    }
    const exists = Object.values(resolved).some(
      (s) => s && s.id.toUpperCase() === sid
    );
    if (exists) {
      toast.error("This student has already been added.");
      return;
    }
    setAddingStudent(true);
    try {
      const res = await fetch(STUDENT_BY_ID_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family_id: fid, student_id: sid }),
      });
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json();
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      const record = arr[0] as Record<string, unknown> | undefined;
      if (!record || !record.Name) {
        toast.error("Student not found.");
        return;
      }
      const student: Student = {
        id: String(record["Reg Number"] ?? sid),
        name: String(record.Name),
        grade: String(record.Class ?? ""),
        fees: Number(record.fees),
      };
      const dup = Object.values(resolved).some(
        (s) => s && s.id.toUpperCase() === student.id.toUpperCase()
      );
      if (dup) {
        toast.error("This student has already been added.");
        return;
      }
      const keys = Object.keys(resolved).map(Number);
      const nextIdx = keys.length ? Math.max(...keys) + 1 : 0;
      setResolved((prev) => ({ ...prev, [nextIdx]: student }));
      setExtraStudentId("");
      toast.success(`${student.name} added.`);
    } catch {
      toast.error("Lookup failed. Please try again.");
    } finally {
      setAddingStudent(false);
    }
  };

  const checkFamily = async () => {
    const id = familyId.trim();
    if (!id) {
      toast.error("Please enter a family ID first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(STUDENT_LOOKUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family_id: id }),
      });
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json();
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      const map: Record<number, Student | null> = {};
      arr.forEach((record: Record<string, unknown>, i: number) => {
        if (record && record.Name) {
          map[i] = {
            id: String(record["Reg Number"] ?? ""),
            name: String(record.Name),
            grade: String(record.Class ?? ""),
            fees: Number(record.fees),
          };
        }
      });
      setResolved(map);
      setSelectedOptional({});
      setSearched(true);
      if (Object.keys(map).length === 0) {
        toast.error("No students found for this family ID.");
      } else {
        fetchOptionalFees();
      }
    } catch {
      setResolved({});
      setSearched(true);
      toast.error("Lookup failed. Please try again.");
    } finally {
      setLoading(false);
    }
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
        <Label htmlFor="familyId">Family ID</Label>
        <div className="flex gap-2 items-center">
          <Input
            id="familyId"
            placeholder="e.g. FAM001"
            value={familyId}
            onChange={(e) => handleFamilyIdChange(e.target.value)}
            className="uppercase"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={loading || !familyId.trim()}
            onClick={checkFamily}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-1" />
                Check
              </>
            )}
          </Button>
        </div>
        {searched && Object.keys(resolved).length === 0 && (
          <div className="text-sm rounded-lg px-3 py-2 bg-destructive/10 text-destructive">
            No students found for this family ID.
          </div>
        )}
        {Object.entries(resolved).map(([key, student]) => {
          const index = Number(key);
          if (!student) return null;
          return (
            <div key={index} className="space-y-1">
              <>
                <div
                  className="text-sm rounded-lg px-3 py-2 flex items-center gap-2 bg-secondary text-secondary-foreground"
                >
                  {(() => {
                    const ids = selectedOptional[index] ?? new Set<number>();
                    const extra = optionalFees
                      .filter((f) => ids.has(f.id))
                      .reduce((s, f) => s + f.amount, 0);
                    const childTotal = student.fees + extra;
                    return (
                      <>
                        <GraduationCap className="h-4 w-4 shrink-0" />
                        <span className="font-medium">{student.name}</span>
                        <span className="text-muted-foreground">
                          — {student.grade}
                        </span>
                        <span className="ml-auto font-semibold">
                          {formatCurrency(childTotal)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 -mr-1"
                          onClick={() => removeStudent(index)}
                          aria-label={`Remove ${student.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    );
                  })()}
                </div>
                {optionalFees.length > 0 && (
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
            </div>
          );
        })}
        {searched && Object.keys(resolved).length > 0 && (
          <div className="space-y-2 pt-2">
            <Label htmlFor="extraStudentId" className="text-xs text-muted-foreground">
              Add another student by Student ID
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                id="extraStudentId"
                placeholder="e.g. STD004"
                value={extraStudentId}
                onChange={(e) => setExtraStudentId(e.target.value.toUpperCase())}
                className="uppercase"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={addingStudent || !extraStudentId.trim()}
                onClick={addStudentById}
              >
                {addingStudent ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
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
