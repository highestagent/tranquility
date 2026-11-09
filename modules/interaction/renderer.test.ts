import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { expect, it } from "vitest"
import { InteractionRenderer } from "./renderer"
it("renders the registered controls with all json-render providers", () => {
  const html = renderToString(
    createElement(InteractionRenderer, {
      interaction: { type: "BinaryChoice", props: { label: "Rested?" } },
      onAnswer: () => {},
    })
  )
  expect(html).toContain("Yes")
  expect(html).toContain("No")
})
