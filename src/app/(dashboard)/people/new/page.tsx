import { CreatePersonForm } from "./create-person-form";

export default function NewPersonPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alta de Persona</h1>
        <p className="text-slate-500 mt-2">
          Ingrese los datos para registrar a un nuevo ciudadano en el sistema único.
        </p>
      </div>

      <CreatePersonForm />
    </div>
  );
}
