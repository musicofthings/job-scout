import { useState } from 'react'

interface Props {
  apiKey: string
  onSave: (key: string) => void
}

export function ApiKeyPanel({ apiKey, onSave }: Props) {
  const [draft, setDraft] = useState(apiKey)
  const [visible, setVisible] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    onSave(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <section className="panel key-panel">
      <div className="panel-head">
        <div>
          <h2>API key (BYOK)</h2>
          <p className="muted">
            Your Firecrawl key stays in this browser only. It is sent to our proxy for the
            request and never stored on the server.
          </p>
        </div>
        <a
          className="link"
          href="https://www.firecrawl.dev/app/api-keys"
          target="_blank"
          rel="noreferrer"
        >
          Get a key →
        </a>
      </div>
      <div className="key-row">
        <div className="input-wrap">
          <input
            type={visible ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="fc-xxxxxxxx"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="ghost" onClick={() => setVisible((v) => !v)}>
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>
        <button type="button" className="primary" onClick={handleSave}>
          {saved ? 'Saved' : 'Save key'}
        </button>
      </div>
      {apiKey ? (
        <p className="status ok">Key loaded · ends with …{apiKey.slice(-4)}</p>
      ) : (
        <p className="status warn">No key saved yet — search will not run without one.</p>
      )}
    </section>
  )
}
