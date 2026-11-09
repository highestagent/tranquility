"use client"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { defineRegistry, Renderer, JSONUIProvider } from "@json-render/react"
import { createContext, useContext, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useAsync } from "@/hooks/use-async"
import { getAssessment, formatMetric } from "@/modules/assessments"
import { measurements } from "@/modules/memory"
import { loadDiscoveryViews } from "@/modules/insights/discovery-data"
import { DiscoveryCard } from "@/modules/insights/discovery-card"
import {
  catalog,
  interactionSchema,
  validAnswer,
  type Interaction,
  type Answer,
} from "./catalog"

const InputContext = createContext<{
  disabled: boolean
  answer: (value: Answer) => void
}>({ disabled: true, answer: () => {} })
function Choices({ options }: { options: { label: string; value: Answer }[] }) {
  const { disabled, answer } = useContext(InputContext)
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => (
        <Button
          key={option.label}
          size="lg"
          variant="outline"
          disabled={disabled}
          onClick={() => answer(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
function ConfirmInput({
  interaction,
}: {
  interaction: Extract<
    Interaction,
    { type: "NumberInput" | "TextInput" | "MultiSelect" }
  >
}) {
  const { disabled, answer } = useContext(InputContext)
  const [value, setValue] = useState<Answer>(
    interaction.type === "MultiSelect" ? [] : null
  )
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (value !== null && validAnswer(interaction, value)) answer(value)
      }}
    >
      {interaction.type === "MultiSelect" ? (
        <fieldset disabled={disabled} className="flex flex-col gap-3">
          <legend className="sr-only">{interaction.props.label}</legend>
          {interaction.props.options.map((option) => (
            <label
              key={option}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <Checkbox
                disabled={disabled}
                checked={Array.isArray(value) && value.includes(option)}
                onCheckedChange={(checked) =>
                  setValue(
                    checked
                      ? [...(Array.isArray(value) ? value : []), option]
                      : (Array.isArray(value) ? value : []).filter(
                          (v) => v !== option
                        )
                  )
                }
              />
              {option}
            </label>
          ))}
        </fieldset>
      ) : interaction.type === "TextInput" ? (
        <Textarea
          aria-label={interaction.props.label}
          maxLength={2000}
          disabled={disabled}
          placeholder={interaction.props.placeholder}
          className="min-h-28 rounded-lg bg-background p-3 text-base"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <label className="flex items-center gap-3">
          <Input
            type="number"
            aria-label={interaction.props.label}
            min={interaction.props.min}
            max={interaction.props.max}
            step={interaction.props.step}
            disabled={disabled}
            className="h-12 w-36 rounded-lg bg-background p-3 text-2xl md:text-2xl"
            value={typeof value === "number" ? value : ""}
            onChange={(e) =>
              setValue(e.target.value === "" ? null : e.target.valueAsNumber)
            }
          />
          {interaction.props.unit}
        </label>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={
          disabled || value === null || !validAnswer(interaction, value)
        }
      >
        Continue
      </Button>
    </form>
  )
}
function Evidence({ id }: { id: string }) {
  const { state, reload } = useAsync(loadDiscoveryViews)
  if (state.status === "loading") return <p role="status">Loading evidence…</p>
  if (state.status === "error")
    return <Button onClick={() => void reload()}>Retry loading evidence</Button>
  const view = state.data.find((v) => v.discovery.id === id)
  return view ? (
    <DiscoveryCard view={view} />
  ) : (
    <p role="alert">This evidence is unavailable.</p>
  )
}
function History({
  assessmentId,
  metricId,
}: {
  assessmentId: string
  metricId: string
}) {
  const load = useCallback(
    () => measurements.byAssessment(assessmentId),
    [assessmentId]
  )
  const { state, reload } = useAsync(load)
  const assessment = getAssessment(assessmentId)
  const metric = assessment?.metrics.find((m) => m.id === metricId)
  if (state.status === "error")
    return <Button onClick={() => void reload()}>Retry loading history</Button>
  if (state.status !== "ready")
    return <p role="status">Loading measurements…</p>
  if (!metric || !assessment) return <p>Measurement unavailable.</p>
  const rows = state.data
    .filter(
      (r) =>
        r.valid &&
        r.protocolVersion === assessment.protocolVersion &&
        Number.isFinite(r.metrics[metricId])
    )
    .slice(-20)
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.metrics[metricId])))
  return (
    <figure>
      <figcaption className="mb-4 text-sm">
        {assessment.shortName} · {metric.label}
      </figcaption>
      {rows.length === 0 ? (
        <p>No measurements yet.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="grid grid-cols-[6rem_1fr_5rem] items-center gap-3 text-xs"
            >
              <time>{new Date(r.completedAt).toLocaleDateString()}</time>
              <span className="h-2 rounded bg-muted">
                <span
                  className="block h-2 rounded bg-glow"
                  style={{
                    width: `${(Math.abs(r.metrics[metricId]) / max) * 100}%`,
                  }}
                />
              </span>
              <span>{formatMetric(r.metrics[metricId], metric)}</span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  )
}
const { registry } = defineRegistry(catalog, {
  components: {
    BinaryChoice: () => (
      <Choices
        options={[
          { label: "Yes", value: true },
          { label: "No", value: false },
        ]}
      />
    ),
    SingleSelect: ({ props }) => (
      <Choices
        options={props.options.map((label) => ({ label, value: label }))}
      />
    ),
    MultiSelect: ({ props }) => (
      <ConfirmInput interaction={{ type: "MultiSelect", props }} />
    ),
    ScaleInput: ({ props }) => (
      <div>
        <Choices
          options={[1, 2, 3, 4, 5].map((value) => ({
            label: String(value),
            value,
          }))}
        />
        <p className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>1 · {props.low}</span>
          <span>5 · {props.high}</span>
        </p>
      </div>
    ),
    NumberInput: ({ props }) => (
      <ConfirmInput interaction={{ type: "NumberInput", props }} />
    ),
    TextInput: ({ props }) => (
      <ConfirmInput interaction={{ type: "TextInput", props }} />
    ),
    ConsentPrompt: ({ props }) => (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{props.disclosure}</p>
        <Choices
          options={[
            { label: "Allow", value: true },
            { label: "Not now", value: false },
          ]}
        />
      </div>
    ),
    AssessmentCard: ({ props }) => {
      const assessment = getAssessment(props.assessmentId)
      return (
        <Card className="gap-4 rounded-xl p-5 text-base">
          <p>{assessment?.shortName}</p>
          <p className="text-sm text-muted-foreground">
            {assessment?.measures} · About{" "}
            {Math.ceil((assessment?.approxSeconds ?? 0) / 60)} minutes
          </p>
          <Choices options={[{ label: "Begin assessment", value: true }]} />
        </Card>
      )
    },
    EvidenceCard: ({ props }) => <Evidence id={props.discoveryId} />,
    ChartView: ({ props }) => <History {...props} />,
  },
})

/** Only parsed literal props enter json-render; no code, expressions or model actions. */
export function InteractionRenderer({
  interaction,
  onAnswer,
  disabled = false,
}: {
  interaction: Interaction
  onAnswer: (value: Answer) => void
  disabled?: boolean
}) {
  const parsed = interactionSchema.safeParse(interaction)
  if (!parsed.success)
    return (
      <p role="alert">This interaction could not be validated. Please retry.</p>
    )
  const value = parsed.data
  return (
    <InputContext.Provider
      value={{
        disabled,
        answer: (answer) => {
          if (!disabled && validAnswer(value, answer)) onAnswer(answer)
        },
      }}
    >
      <JSONUIProvider registry={registry}>
        <Renderer
          registry={registry}
          spec={{
            root: "interaction",
            elements: {
              interaction: {
                type: value.type,
                props: value.props,
                children: [],
              },
            },
          }}
        />
      </JSONUIProvider>
    </InputContext.Provider>
  )
}
