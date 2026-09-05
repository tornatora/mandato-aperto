# Metodologia — versione 0.1.2

## Principio

L'Indice di attività documentata rende comparabili quattro quantità pubbliche. L'interfaccia mostra in primo piano la **fascia di inattività documentata**, calcolata come `100 − indice di attività`: un valore più alto segnala quindi meno attività rilevata. Non esprime un giudizio sulla qualità, sull'utilità o sull'orientamento politico dell'attività.

La versione pubblicata sostituisce ogni identità con un codice casuale, rimuove nomi, partiti, circoscrizioni, identificativi, fotografie e collegamenti personali e converte tutti i valori puntuali in fasce. L'ordine viene rimescolato a ogni aggiornamento. Non viene promessa anonimizzazione statistica irreversibile perché i dati di origine sono pubblici.

## Indicatori

| Indicatore | Peso | Definizione |
|---|---:|---|
| Partecipazione alle votazioni | 50% | Voti espressi divisi per voti espressi più “non ha partecipato”. Missioni e presidenza di turno sono escluse dal denominatore. |
| Proposte di legge da primo firmatario | 20% | Numero di atti classificati dalla Camera come “Progetto di Legge” con il deputato primo firmatario. |
| Atti di indirizzo e controllo | 15% | Interrogazioni, interpellanze, mozioni, risoluzioni e ordini del giorno da primo firmatario. |
| Interventi parlamentari | 15% | Interventi associati al deputato nel grafo ufficiale della Camera. |

Per i tre indicatori di volume, il valore viene rapportato al 95° percentile dei deputati in carica e trasformato con `log(1 + valore)`. Il 95° percentile impedisce a pochi valori estremi di schiacciare tutti gli altri.

Formula:

```text
indice = 50 × partecipazione
       + 20 × scala_log(proposte_di_legge)
       + 15 × scala_log(atti_di_controllo)
       + 15 × scala_log(interventi)
```

Il risultato viene arrotondato a un intero da 0 a 100. Prima della pubblicazione viene trasformato in una fascia di dieci punti; la fascia di inattività è l'intervallo inverso. Per esempio, attività `70–79` diventa inattività `21–30`.

Le etichette dividono i punteggi validi in cinque gruppi usando i percentili 20, 40, 60 e 80. “Tra i più inattivi” e “tra i meno inattivi” indicano una posizione relativa nel dataset corrente, non un giudizio positivo o negativo sulla persona.

## Limiti dichiarati

1. Una votazione elettronica non equivale a una giornata di presenza fisica.
   Il Presidente della Camera, quando presiede, non è confrontato sulla partecipazione al voto e può risultare “ruolo non comparabile”.
2. Più atti non significa automaticamente atti migliori.
3. Governo, opposizione, presidenze e incarichi parlamentari hanno funzioni diverse.
4. Il lavoro politico sul territorio, negoziale o preparatorio può non comparire nei dati.
5. Il dato ufficiale può essere corretto o riclassificato dall'istituzione dopo la pubblicazione.
6. Il confronto ha senso solo nello stesso organo e nello stesso periodo.

Per queste ragioni la piattaforma mostra soltanto indicatori per fasce, la data di aggiornamento e una descrizione non cliccabile della provenienza.

## Regole editoriali

- nessuna accusa anonima entra nel dataset;
- nessun procedimento giudiziario viene presentato come condanna;
- le rettifiche documentate hanno priorità;
- ogni variazione della formula richiede una proposta pubblica e un confronto prima/dopo;
- partiti e orientamenti non influenzano il punteggio;
- popolarità social, sentiment e copertura mediatica sono esclusi.
