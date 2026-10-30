"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Pencil, Search, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormSection, RequiredNote, fieldSelectClass } from "@/components/ui/form-section";
import { AddressFields, type AddressValue } from "@/components/people/address-fields";
import { FICHA_LIMITS, type FichaNnya } from "@/lib/convenio-nnya";
import { GENEROS } from "@/lib/person-display";
import type { AddressOptions } from "@/lib/localidades";
import { buscarEnRegistroAction, guardarFichaNnyaAction, sacarNnyaAction, sumarNnyaAction } from "@/app/(dashboard)/convenios/actions";

const failed = (res: { success: boolean; error?: string } | null) =>
  toast.error(res && !res.success && res.error ? res.error : "No se pudo guardar. Probá de nuevo.");

type Encontrado = { dni: string; nombre: string; edad: number | null; domicilio: string | null; enConvenio: boolean };
type FichaForm = { motivo: string; interviene: string; obraSocial: string; observaciones: string };

const fichaVacia: FichaForm = { motivo: "", interviene: "", obraSocial: "", observaciones: "" };
const fichaDe = (f: FichaNnya): FichaForm => ({
  motivo: f.motivo ?? "",
  interviene: f.interviene ?? "",
  obraSocial: f.obraSocial ?? "",
  observaciones: f.observaciones ?? "",
});

/** Los datos del acompañamiento en el convenio. No hay adulto responsable: quien acompaña es la cuidadora. */
function FichaFields({ form, setForm, idPrefix }: { form: FichaForm; setForm: (f: FichaForm) => void; idPrefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label="Quién interviene"
        htmlFor={`${idPrefix}-interviene`}
        hint="El juzgado o el Servicio Local, con su número de causa si lo tiene."
      >
        <Input
          id={`${idPrefix}-interviene`}
          maxLength={FICHA_LIMITS.interviene}
          value={form.interviene}
          onChange={(e) => setForm({ ...form, interviene: e.target.value })}
          placeholder="Ej: Juzgado de Familia N° 2 de San Martín"
          className="h-10 rounded-xl"
        />
      </Field>
      <Field label="Obra social" htmlFor={`${idPrefix}-obra-social`}>
        <Input
          id={`${idPrefix}-obra-social`}
          maxLength={FICHA_LIMITS.obraSocial}
          value={form.obraSocial}
          onChange={(e) => setForm({ ...form, obraSocial: e.target.value })}
          placeholder="Ej: IOMA, o “No tiene”"
          className="h-10 rounded-xl"
        />
      </Field>
      <Field label="Motivo del ingreso" htmlFor={`${idPrefix}-motivo`} className="sm:col-span-2">
        <Textarea
          id={`${idPrefix}-motivo`}
          rows={2}
          maxLength={FICHA_LIMITS.motivo}
          value={form.motivo}
          onChange={(e) => setForm({ ...form, motivo: e.target.value })}
          className="rounded-xl"
        />
      </Field>
      <Field label="Observaciones" htmlFor={`${idPrefix}-observaciones`} className="sm:col-span-2">
        <Textarea
          id={`${idPrefix}-observaciones`}
          rows={2}
          maxLength={FICHA_LIMITS.observaciones}
          value={form.observaciones}
          onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
          className="rounded-xl"
        />
      </Field>
    </div>
  );
}

type Persona = AddressValue & {
  dni: string;
  lastName: string;
  firstName: string;
  fechaNacimiento: string;
  genero: string;
  telefono: string;
};
const personaVacia: Persona = {
  dni: "",
  lastName: "",
  firstName: "",
  fechaNacimiento: "",
  genero: "",
  telefono: "",
  direccion: "",
  barrio: "",
  localidad: "",
};

/**
 * Sumar un niño, niña o adolescente al convenio: se busca en el padrón y el Registro Único por DNI o nombre;
 * si no está, se carga ahí mismo (queda en el Registro Único). Se puede abrir desde un botón o desde afuera (`open`).
 */
export function SumarNnyaDialog({
  agreementId,
  addressOptions,
  puedeCargarPersona,
  open: openProp,
  onOpenChange,
  onSumado,
  trigger = true,
}: {
  agreementId: string;
  addressOptions: AddressOptions;
  puedeCargarPersona: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSumado?: (n: { dni: string; nombre: string }) => void;
  trigger?: boolean;
}) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const [paso, setPaso] = useState<"buscar" | "elegido" | "nuevo">("buscar");
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Encontrado[] | null>(null);
  const [elegido, setElegido] = useState<Encontrado | null>(null);
  const [persona, setPersona] = useState<Persona>(personaVacia);
  const [ficha, setFicha] = useState<FichaForm>(fichaVacia);
  const [saving, setSaving] = useState(false);

  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOpenState(v);
    onOpenChange?.(v);
    if (!v) {
      setPaso("buscar");
      setQ("");
      setResultados(null);
      setElegido(null);
      setPersona(personaVacia);
      setFicha(fichaVacia);
    }
  };

  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 3) {
      setResultados(null);
      setBuscando(false);
      return;
    }
    let vigente = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      const r = await buscarEnRegistroAction(agreementId, texto).catch(() => []);
      if (!vigente) return;
      setResultados(r);
      setBuscando(false);
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [q, agreementId]);

  const cargarNuevo = () => {
    const soloNumeros = q.replace(/[.\s]/g, "");
    setPersona({ ...personaVacia, dni: /^\d+$/.test(soloNumeros) ? soloNumeros : "" });
    setPaso("nuevo");
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const datos = paso === "nuevo" ? { ...persona, nuevo: "1", ...ficha } : { dni: elegido?.dni, ...ficha };
    setSaving(true);
    const res = await sumarNnyaAction(agreementId, datos).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    const nombre = res.nombre;
    toast.success(paso === "nuevo" ? `${nombre} quedó en el Registro Único y en el convenio.` : `${nombre} quedó en el convenio.`);
    onSumado?.({ dni: res.dni, nombre });
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" /> Sumar niño o niña
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {paso === "buscar" ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Sumar un niño, niña o adolescente</DialogTitle>
              <DialogDescription>Buscalo en el Registro Único por DNI o por apellido. Si no está, lo cargás desde acá.</DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                autoFocus
                aria-label="DNI o apellido"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="DNI o apellido (al menos 3 letras o números)"
                autoComplete="off"
                className="h-10 rounded-xl pl-9"
              />
            </div>
            {buscando && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Buscando…
              </p>
            )}
            {!buscando && resultados && (
              <div className="space-y-3">
                {resultados.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No aparece en el padrón ni en el Registro Único.</p>
                ) : (
                  <ul className="divide-y divide-border/50 rounded-2xl border border-border/60" aria-label="Resultados">
                    {resultados.map((r) => (
                      <li key={r.dni}>
                        <button
                          type="button"
                          disabled={r.enConvenio}
                          onClick={() => {
                            setElegido(r);
                            setPaso("elegido");
                          }}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-foreground">{r.nombre}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              DNI {r.dni}
                              {r.edad !== null ? ` · ${r.edad} ${r.edad === 1 ? "año" : "años"}` : ""}
                              {r.domicilio ? ` · ${r.domicilio}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-primary">
                            {r.enConvenio ? "Ya está en el convenio" : "Elegir"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {puedeCargarPersona ? (
                  <Button type="button" variant="outline" onClick={cargarNuevo} className="gap-2">
                    <UserPlus className="h-4 w-4" /> No está: cargarlo en el Registro Único
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">Si no está, pedí que lo carguen en el Registro Único.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={guardar} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{paso === "nuevo" ? "Cargar en el Registro Único y sumar" : `Sumar a ${elegido?.nombre}`}</DialogTitle>
              <DialogDescription>
                {paso === "nuevo"
                  ? "Queda cargado en el Registro Único, como cualquier persona, y en la lista del convenio."
                  : `DNI ${elegido?.dni}. Sus datos personales vienen del Registro Único: si hay que corregirlos, se hace desde su ficha.`}
              </DialogDescription>
            </DialogHeader>
            {paso === "nuevo" && (
              <FormSection title="Datos personales" description="Van al Registro Único." variant="plain">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="DNI" htmlFor="sumar-dni" required hint="Sin puntos. Si no tiene DNI, otro documento.">
                    <Input
                      id="sumar-dni"
                      required
                      inputMode="numeric"
                      autoComplete="off"
                      value={persona.dni}
                      onChange={(e) => setPersona({ ...persona, dni: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </Field>
                  <Field label="Fecha de nacimiento" htmlFor="sumar-nacimiento">
                    <Input
                      id="sumar-nacimiento"
                      type="date"
                      value={persona.fechaNacimiento}
                      onChange={(e) => setPersona({ ...persona, fechaNacimiento: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </Field>
                  <Field label="Apellido" htmlFor="sumar-apellido" required>
                    <Input
                      id="sumar-apellido"
                      required
                      value={persona.lastName}
                      onChange={(e) => setPersona({ ...persona, lastName: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </Field>
                  <Field label="Nombre" htmlFor="sumar-nombre" required>
                    <Input
                      id="sumar-nombre"
                      required
                      value={persona.firstName}
                      onChange={(e) => setPersona({ ...persona, firstName: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </Field>
                  <Field label="Género" htmlFor="sumar-genero">
                    <select
                      id="sumar-genero"
                      value={persona.genero}
                      onChange={(e) => setPersona({ ...persona, genero: e.target.value })}
                      className={fieldSelectClass}
                    >
                      <option value="">Sin cargar</option>
                      {GENEROS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Teléfono" htmlFor="sumar-telefono" hint="Por ejemplo, el del hogar o la institución donde vive.">
                    <Input
                      id="sumar-telefono"
                      inputMode="tel"
                      value={persona.telefono}
                      onChange={(e) => setPersona({ ...persona, telefono: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </Field>
                </div>
                <AddressFields
                  value={persona}
                  onChange={(v) => setPersona({ ...persona, ...v })}
                  options={addressOptions}
                  idPrefix="sumar-domicilio"
                  inputClassName="h-10 rounded-xl"
                  labelClassName="text-sm font-semibold text-foreground"
                />
              </FormSection>
            )}
            <FormSection title="En el convenio" description="Todo opcional. Se puede completar después." variant="plain">
              <FichaFields form={ficha} setForm={setFicha} idPrefix="sumar" />
            </FormSection>
            {paso === "nuevo" && <RequiredNote />}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setPaso("buscar")} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Volver a buscar
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Sumar al convenio
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Corregir los datos del acompañamiento. */
export function FichaNnyaButton({ agreementId, nnya }: { agreementId: string; nnya: FichaNnya & { id: string; nombre: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FichaForm>(fichaDe(nnya));
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await guardarFichaNnyaAction(agreementId, nnya.id, form).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Datos guardados.");
    setOpen(false);
    router.refresh();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setForm(fichaDe(nnya));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Editar datos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Datos de {nnya.nombre} en el convenio</DialogTitle>
            <DialogDescription>En Auditoría queda qué datos se cambiaron y quién, sin el contenido.</DialogDescription>
          </DialogHeader>
          <FichaFields form={form} setForm={setForm} idPrefix={`ficha-${nnya.id}`} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Sacar de la lista a quien se sumó por error (solo si todavía no tiene horas). */
export function SacarNnyaButton({ agreementId, nnyaId, nombre }: { agreementId: string; nnyaId: string; nombre: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const remove = async () => {
    if (!window.confirm(`¿Sacar a ${nombre} de la lista del convenio? Sigue en el Registro Único.`)) return;
    setSaving(true);
    const res = await sacarNnyaAction(agreementId, nnyaId).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success(`${nombre} salió de la lista.`);
    router.refresh();
  };
  return (
    <Button variant="outline" size="sm" onClick={remove} disabled={saving} className="gap-1.5">
      <UserMinus className="h-3.5 w-3.5" /> Sacar de la lista
    </Button>
  );
}
