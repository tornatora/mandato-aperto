# Metodologia — versione 0.1.0

## Principio

L'Indice di attività documentata rende comparabili quattro quantità pubbliche. Non esprime un giudizio sulla qualità, sull'utilità o sull'orientamento politico dell'attività.

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

Il risultato viene arrotondato a un intero da 0 a 100.

Le etichette di fascia dividono i punteggi validi in cinque gruppi usando i percentili 20, 40, 60 e 80. “Fascia superiore” e “fascia inferiore” indicano quindi una posizione relativa nel dataset corrente, non un giudizio positivo o negativo sulla persona.

## Limiti dichiarati

1. Una votazione elettronica non equivale a una giornata di presenza fisica.
   Il Presidente della Camera, quando presiede, non è confrontato sulla partecipazione al voto e può risultare “ruolo non comparabile”.
2. Più atti non significa automaticamente atti migliori.
3. Governo, opposizione, presidenze e incarichi parlamentari hanno funzioni diverse.
4. Il lavoro politico sul territorio, negoziale o preparatorio può non comparire nei dati.
5. Il dato ufficiale può essere corretto o riclassificato dall'istituzione dopo la pubblicazione.
6. Il confronto ha senso solo nello stesso organo e nello stesso periodo.

Per queste ragioni la piattaforma mostra sempre gli indicatori separati, la data di aggiornamento e i collegamenti alle fonti.

## Regole editoriali

- nessuna accusa anonima entra nel dataset;
- nessun procedimento giudiziario viene presentato come condanna;
- le rettifiche documentate hanno priorità;
- ogni variazione della formula richiede una proposta pubblica e un confronto prima/dopo;
- partiti e orientamenti non influenzano il punteggio;
- popolarità social, sentiment e copertura mediatica sono esclusi.
