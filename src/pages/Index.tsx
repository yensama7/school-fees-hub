import { SchoolFeesForm } from "@/components/SchoolFeesForm";

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            School Fees Payment
          </h1>
          <p className="text-muted-foreground mt-2">
            Enter your details and your child's student ID to pay fees online.
          </p>
        </div>
        <SchoolFeesForm />
      </div>
    </div>
  );
};

export default Index;
