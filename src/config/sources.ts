// Quellenangaben für Einstellungen → Quellen (Lizenzpflicht, siehe data/source/SOURCE.md).

export interface Source {
  name: string;
  description: string;
  url: string;
  license: string;
  licenseUrl: string;
}

export const SOURCES: Source[] = [
  {
    name: 'FrequencyWords (Hermit Dave)',
    description: 'Häufigkeitsliste Spanisch auf Basis von OpenSubtitles 2018 – gesprochene Sprache, Gewicht 2/3',
    url: 'https://github.com/hermitdave/FrequencyWords',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    name: 'Leipzig Corpora Collection (Universität Leipzig)',
    description: 'Spanisch: Nachrichten 2022 und Wikipedia 2021 – geschriebene Sprache, Gewicht 1/3',
    url: 'https://wortschatz.uni-leipzig.de/en/download/',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
];

export const DERIVED_LICENSE_NOTE =
  'Die daraus abgeleitete Rangliste (Grundformen, Rang, Anteil) steht unter CC BY-SA 4.0.';
