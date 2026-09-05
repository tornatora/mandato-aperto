# Mandato Aperto

**Dati, fatti, alternative.** Mandato Aperto pubblica esclusivamente record anonimi e fasce aggregate, senza nomi, partiti, circoscrizioni o collegamenti personali.

**Apri l'app:** https://tornatora.github.io/mandato-aperto/

La prima versione deriva da dati istituzionali relativi alla XIX legislatura. La pubblicazione rimuove tutti gli elementi identificativi e sostituisce i valori puntuali con intervalli.

## Che cosa fa

- cerca un record esclusivamente tramite codice anonimo;
- mostra partecipazione alle votazioni elettroniche, prime firme, atti di controllo e interventi;
- calcola un **Indice di attività documentata** con formula pubblica e versionata;
- confronta due rappresentanti senza classifiche editoriali preimpostate;
- crea, senza codice e solo sul dispositivo, una scheda di alternativa basata su fonti, trasparenza e impegni misurabili;
- esclude dal calcolo delle assenze le missioni e la presidenza di turno;
- aggiorna automaticamente i dati tramite GitHub Actions;
- consente rettifiche tracciabili attraverso le issue del repository.

## Minimizzazione e anonimizzazione editoriale

- nomi e cognomi non sono pubblicati;
- partiti, gruppi e circoscrizioni non sono pubblicati;
- ID originari, URI, fotografie e collegamenti personali sono rimossi;
- partecipazione, atti, interventi e indice sono pubblicati soltanto per fasce;
- l'ordine dei record viene rimescolato a ogni aggiornamento.

Le fonti originarie restano pubbliche presso le istituzioni. Il progetto non promette anonimizzazione statistica irreversibile né immunità da responsabilità legali.

## Che cosa non fa

Mandato Aperto non misura onestà, competenza, qualità delle leggi, efficacia politica o aderenza a un'ideologia. Non definisce nessuno “nullafacente” e non può revocare un eletto. Il ricambio avviene con gli strumenti previsti dall'ordinamento democratico; il progetto aiuta gli elettori a confrontare fatti verificabili.

## Avvio senza installazioni

Apri `dist/index.html` in un browser. Non servono dipendenze, database o chiavi API.

Per aggiornare i dati manualmente:

```bash
npm run sync
npm run validate
```

Chi non programma può usare il flusso descritto in [OPERATIONS-NO-CODE.md](OPERATIONS-NO-CODE.md).

## Fonti

Fonti istituzionali parlamentari. I riferimenti diretti alle singole persone non sono inclusi nella pubblicazione.

Consulta [METHODOLOGY.md](METHODOLOGY.md) per formula, limiti e definizioni.

## Roadmap

- **v0.1** — Camera dei deputati, confronto e fonti verificabili;
- **v0.2** — Senato della Repubblica;
- **v0.3** — Parlamento europeo, Regioni e grandi Comuni con schemi separati;
- **v0.4** — confronto con candidature ufficiali durante il periodo elettorale;
- **v1.0** — governance indipendente, audit esterno e diritto di replica pubblico.

## Contribuire

Correzioni, nuove fonti e modifiche dell'algoritmo devono essere proposte in modo tracciabile. Leggi [CONTRIBUTING.md](CONTRIBUTING.md) e [GOVERNANCE.md](GOVERNANCE.md).

## Licenza

Codice MIT. I dati mantengono le condizioni di riuso e attribuzione stabilite dai rispettivi titolari istituzionali.
