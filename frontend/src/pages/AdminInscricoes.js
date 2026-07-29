{turmas.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nome} — {t.serie_classe}ª{t.curso_nome ? ` · ${t.curso_nome}` : ''} ({t.turno})
                    </option>
                  ))}