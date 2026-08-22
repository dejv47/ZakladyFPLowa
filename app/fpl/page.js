"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BetsTab } from "./BetsTab";

function managerKey(p){
 return `${p.manager}__${p.team}`.toLowerCase().replace(/\s+/g,"_");
}
function confHash(s){
 let h=2166136261;
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
 return h>>>0;
}
function conferenceMood(p, league){
 const pts=Number(p.gwPoints||0);
 const sorted=[...(league||[])].sort((a,b)=>Number(b.gwPoints||0)-Number(a.gwPoints||0));
 const rank=sorted.findIndex(x=>x.entry===p.entry)+1;
 const n=Math.max(sorted.length,1);
 const avg=sorted.reduce((s,x)=>s+Number(x.gwPoints||0),0)/n;
 if(rank===1 || pts>=avg+12) return "great";
 if(rank>0 && rank<=Math.max(2,Math.ceil(n*.25))) return "good";
 if(rank===n || pts<=avg-18) return "awful";
 if(rank>=Math.ceil(n*.75) || pts<=avg-10) return "bad";
 return "neutral";
}
function gwRank(p,league){
 return [...(league||[])].sort((a,b)=>Number(b.gwPoints||0)-Number(a.gwPoints||0))
   .findIndex(x=>x.entry===p.entry)+1;
}

/*
 Each slot below has its OWN voice and sentence construction.
 No conference sentence is shared between slots.
 Each mood also has 4 GW variants so the same manager does not repeat
 the same wording every round.
*/
const MANAGER_VOICES = [
 { // 0 - swagger / arrogance
  great:[
   p=>`${p.manager} wszedł na salę jak człowiek, który właśnie kupił tę ligę wraz z prawami telewizyjnymi. ${p.gwPoints} pkt zrobiło swoje.`,
   p=>`W ${p.team} otwarto dziś szampana bezalkoholowego, bo ${p.manager} chce pamiętać, jak to jest być najlepszym w kolejce.`,
   p=>`${p.manager} nie usiadł przed mikrofonem — praktycznie się przed nim rozsiadł. Przy ${p.gwPoints} pkt można sobie na chwilę pozwolić.`,
   p=>`Po tym wyniku ${p.manager} wyglądał, jakby zaraz miał ogłosić własną dynastię. ${p.team} chwilowo daje mu do tego argumenty.`
  ],
  good:[
   p=>`${p.manager} był zadowolony, ale jeszcze nie arogancki. Redakcja daje mu maksymalnie tydzień.`,
   p=>`${p.team} zaliczyło solidny weekend, więc ${p.manager} pierwszy raz od dawna nie musiał tłumaczyć się ze wszystkiego.`,
   p=>`${p.manager} przyjął wynik z miną człowieka, który wie, że zrobił dobrze, ale jeszcze boi się powiedzieć to za głośno.`,
   p=>`W obozie ${p.team} jest lekki uśmiech. Nie parada, nie pomnik — po prostu weekend bez przypału.`
  ],
  neutral:[
   p=>`${p.manager} przyznał, że ta kolejka była jak letnia herbata: da się wypić, ale nikt nie będzie wspominał.`,
   p=>`${p.team} przeżyło GW bez katastrofy i bez fajerwerków. ${p.manager} nazywa to „kontrolą”.`,
   p=>`${p.manager} wyglądał dokładnie tak, jak jego wynik: ani szczęśliwy, ani załamany, trochę wkurwiony.`,
   p=>`To była kolejka tak przeciętna, że ${p.manager} nie znalazł nawet czego porządnie bronić na konferencji.`
  ],
  bad:[
   p=>`${p.manager} wszedł bez uśmiechu. Przy takim wyniku nawet jego ego wolało zostać w szatni.`,
   p=>`W ${p.team} zamiast konferencji powinno być przesłuchanie. ${p.manager} wie, że kilka decyzji wymaga wyjaśnień.`,
   p=>`${p.manager} próbował zachować spokój, ale ton głosu mówił: „tak, też widziałem tę jebaną ławkę”.`,
   p=>`Po tej kolejce ${p.manager} nie wyglądał jak właściciel ligi. Bardziej jak ktoś, komu właśnie ją odebrano.`
  ],
  awful:[
   p=>`${p.manager} pojawił się na konferencji tylko dlatego, że regulamin podobno zabrania ucieczki przez okno.`,
   p=>`${p.team} zaliczyło taki wpierdol, że ${p.manager} przez chwilę pytał, czy można anulować GW administracyjnie.`,
   p=>`Na twarzy ${p.manager} było wszystko: szok, żal i świadomość, że screenshoty już krążą po grupie.`,
   p=>`${p.manager} zaczął od „dzień dobry”, po czym wynik przypomniał wszystkim, że dobry to ten dzień raczej nie był.`
  ]
 },
 { // 1 - courtroom voice
  great:[
   p=>`Sąd FPL w sprawie ${p.manager} przeciwko rozsądkowi wydał dziś zaskakujący wyrok: niewinny, a nawet cholernie skuteczny.`,
   p=>`Prokuratura wycofała zarzuty wobec ${p.team}. Dowód numer jeden: ${p.gwPoints} punktów.`,
   p=>`${p.manager} pojawił się z teczką pełną punktów. Tym razem materiał dowodowy działa na jego korzyść.`,
   p=>`Po analizie akt GW sąd uznał, że ${p.manager} może przez tydzień chodzić bez kuratora.`
  ],
  good:[
   p=>`Sprawa ${p.team} została warunkowo umorzona. ${p.manager} zrobił wystarczająco dużo dobrego, by uniknąć aktu oskarżenia.`,
   p=>`Prokurator FPL nie znalazł dziś podstaw do zatrzymania ${p.manager}. Kilka decyzji wyglądało wręcz legalnie.`,
   p=>`W aktach ${p.team} są drobne wykroczenia, ale ogólny bilans kolejki broni oskarżonego.`,
   p=>`${p.manager} opuszcza salę sądową bez kajdanek. Wynik był przyzwoity i to go uratowało.`
  ],
  neutral:[
   p=>`Postępowanie wobec ${p.manager} pozostaje otwarte. Za mało dobrego na uniewinnienie, za mało złego na wyrok.`,
   p=>`Biegli przejrzeli kolejkę ${p.team} i wzruszyli ramionami. Materiał dowodowy jest wyjątkowo nudny.`,
   p=>`${p.manager} otrzymał pouczenie zamiast kary. Następny deadline pokaże, czy coś zrozumiał.`,
   p=>`Sąd odroczył rozprawę ${p.team}. Ta kolejka nie dostarczyła ani sensacji, ani mocnych dowodów.`
  ],
  bad:[
   p=>`Prokuratura FPL wszczęła postępowanie wobec ${p.manager}. Zarzuty: złe decyzje, słaby wynik i bezczelność wobec logiki.`,
   p=>`W aktach ${p.team} pojawiły się nowe dowody. ${p.manager} skorzystał z prawa do milczenia przy pytaniu o skład.`,
   p=>`Sędzia poprosił ${p.manager} o wyjaśnienie decyzji. Odpowiedź „wydawało się sensowne” nie została uznana za okoliczność łagodzącą.`,
   p=>`${p.team} ma problem prawny: liczby zeznają przeciwko własnemu menedżerowi.`
  ],
  awful:[
   p=>`Akt oskarżenia wobec ${p.manager} ma już więcej stron niż instrukcja do FPL. Obrona odmówiła komentarza.`,
   p=>`Sąd uznał ${p.team} za miejsce zbrodni, a ${p.manager} za osobę ostatnio widzianą przy przycisku Save My Team.`,
   p=>`Prokurator przeczytał wynik ${p.manager}, zamknął teczkę i powiedział tylko: „ja pierdolę”.`,
   p=>`W sprawie ${p.team} nie będzie ugody. Dowody są brutalne, a tabela wyjątkowo rozmowna.`
  ]
 },
 { // 2 - medical voice
  great:[
   p=>`Lekarze wypisali ${p.manager} z oddziału FPL. Wyniki są świetne, ciśnienie stabilne, ego lekko podwyższone.`,
   p=>`${p.team} odzyskało puls. ${p.manager} po dobrym wyniku wygląda zdrowiej niż przez cały poprzedni tydzień.`,
   p=>`Badania ${p.manager} wykazały wysokie stężenie zielonych strzałek i niebezpieczny wzrost pewności siebie.`,
   p=>`Stan ${p.team}: bardzo dobry. Lekarz zaleca nie dotykać składu bez wyraźnej potrzeby.`
  ],
  good:[
   p=>`Pacjent ${p.manager} reaguje na leczenie. Punkty wróciły, panika ustąpiła, wildcard nie jest dziś potrzebny.`,
   p=>`${p.team} jest w stanie stabilnym. ${p.manager} może wrócić do domu, ale aplikację powinien otwierać z umiarem.`,
   p=>`Parametry ${p.manager} wyglądają zdrowo. Nie ma potrzeby amputowania połowy składu.`,
   p=>`Konsylium uznało, że ${p.team} przeżyje bez radykalnej terapii transferowej.`
  ],
  neutral:[
   p=>`Stan ${p.manager}: stabilny, bez poprawy i bez gwałtownego pogorszenia. Typowe FPL-owe podgorączkowe.`,
   p=>`Badania ${p.team} są nijakie. Nic nie alarmuje, nic nie cieszy. Lekarz zaleca cierpliwość.`,
   p=>`${p.manager} nie wymaga hospitalizacji, ale obserwacja do kolejnego deadline'u pozostaje wskazana.`,
   p=>`Pacjent żyje. To najważniejszy wniosek z tej kolejki ${p.team}.`
  ],
  bad:[
   p=>`${p.manager} trafił na obserwację. Objawy: czerwone strzałki, nerwowe transfery i przewlekłe patrzenie na ławkę.`,
   p=>`Stan ${p.team} pogorszył się po weekendzie. Lekarz zabronił ${p.manager} podejmowania decyzji po 23:00.`,
   p=>`Wyniki badań są słabe. ${p.manager} pytał o wildcard, ale lekarz przepisał mu najpierw sen i rozsądek.`,
   p=>`${p.team} ma gorączkę transferową. Głównym nosicielem pozostaje ${p.manager}.`
  ],
  awful:[
   p=>`Oddział ratunkowy przyjął ${p.manager} po ciężkim urazie rankingowym. Rokowania zależą od tego, czy przestanie dotykać składu.`,
   p=>`Stan ${p.team}: krytyczny. Defibrylator, wildcard i trzy zdrowaśki przygotowane.`,
   p=>`Lekarz spojrzał na wynik ${p.manager} i zapytał, czy to na pewno nie jest literówka.`,
   p=>`W dokumentacji ${p.team} wpisano: „ostry przypadek samosabotażu fantasy”.`
  ]
 },
 { // 3 - corporate/CEO
  great:[
   p=>`${p.manager} zaprezentował wyniki kwartalne ${p.team} i po raz pierwszy slajd „performance” nie wymagał kreatywnej księgowości.`,
   p=>`Zarząd ${p.team} zatwierdził premię dla ${p.manager}. Akcjonariusze dostali punkty zamiast obietnic.`,
   p=>`Raport ${p.team} wygląda świetnie: wzrost, punkty i brak konieczności zwalniania prezesa.`,
   p=>`${p.manager} zakończył GW jak CEO po rekordowym kwartale. PowerPoint praktycznie sam się oklaskiwał.`
  ],
  good:[
   p=>`Wyniki ${p.team} są na plus. ${p.manager} nie dostał premii, ale też nikt nie aktualizuje LinkedIna.`,
   p=>`Zarząd ocenił kolejkę pozytywnie. KPI zostały dowiezione bez większego korporacyjnego bullshitu.`,
   p=>`${p.manager} zamknął tydzień solidnie. Dział PR nie musiał nawet używać słowa „transformacja”.`,
   p=>`Akcjonariusze ${p.team} są spokojni. Na razie nie żądają głowy ${p.manager}.`
  ],
  neutral:[
   p=>`Raport ${p.team}: „zgodnie z oczekiwaniami”. Najbardziej korporacyjne określenie przeciętności, jakie istnieje.`,
   p=>`${p.manager} dowiózł dokładnie tyle, żeby spotkanie zarządu skończyło się bez awantury i bez szampana.`,
   p=>`KPI ${p.team} są płaskie. ${p.manager} nazwał to „fazą konsolidacji”.`,
   p=>`W firmie ${p.team} business as usual. Czyli trochę punktów i dużo maili.`
  ],
  bad:[
   p=>`Zarząd ${p.team} zażądał planu naprawczego. ${p.manager} przyniósł listę transferów, co tylko pogorszyło atmosferę.`,
   p=>`Wyniki kwartalne są słabe. CFO zapytał ${p.manager}, dlaczego tyle punktów wydano na hity.`,
   p=>`Akcjonariusze ${p.team} nie kupili narracji o procesie. Chcą punktów, nie roadmapy.`,
   p=>`${p.manager} zachował stanowisko, ale HR już zarezerwował salę na „rozmowę rozwojową”.`
  ],
  awful:[
   p=>`Walne zgromadzenie ${p.team} trwało siedem minut. Sześć z nich poświęcono pytaniu, co ${p.manager} właściwie odpierdolił.`,
   p=>`Kurs akcji ${p.team} runął po publikacji wyniku. ${p.manager} zapewnia, że fundamenty są zdrowe. Nikt mu nie wierzy.`,
   p=>`Zarząd zamroził budżet transferowy ${p.manager}. Powód: zagrożenie dla majątku spółki.`,
   p=>`Raport audytora ${p.team} zawiera jedno zdanie: „natychmiast ograniczyć dostęp menedżera do aplikacji”.`
  ]
 },
 { // 4 - military
  great:[p=>`${p.manager} zameldował wykonanie zadania. ${p.team} wraca z GW z kompletem honorów i bez strat własnych.`,p=>`Operacja ${p.team} zakończona sukcesem. ${p.manager} może dziś przypiąć sobie medal z zielonej strzałki.`,p=>`Dowódca ${p.manager} poprowadził skład przez kolejkę bez większych strat. Wróg został wypunktowany.`,p=>`${p.team} wygrało bitwę weekendu. ${p.manager} przez chwilę może udawać Napoleona FPL.`],
  good:[p=>`Misja ${p.team} wykonana poprawnie. ${p.manager} nie zdobył stolicy, ale wrócił z punktami.`,p=>`Dowództwo ocenia działania ${p.manager} pozytywnie. Front rankingowy przesunął się we właściwą stronę.`,p=>`${p.team} utrzymało pozycje i dołożyło kilka punktowych zdobyczy. Bez bohaterstwa, bez dezercji.`,p=>`Raport bojowy ${p.manager}: solidnie. Ammunicja punktowa wykorzystana rozsądnie.`],
  neutral:[p=>`Na froncie ${p.team} bez przełomu. ${p.manager} wraca z patrolu z dokładnie tym samym poziomem frustracji.`,p=>`Operacja GW zakończyła się bez zwycięstwa i bez klęski. Dowództwo wzruszyło ramionami.`,p=>`${p.manager} utrzymał linię, ale nie ruszył naprzód. Wojna FPL trwa.`,p=>`Raport ${p.team}: brak istotnych zmian na froncie rankingowym.`],
  bad:[p=>`${p.team} cofnęło się pod naporem blanków. ${p.manager} zarządził odwrót od panicznych transferów.`,p=>`Dowództwo ${p.manager} popełniło kilka błędów taktycznych. Wróg nazywa się „własna ławka”.`,p=>`Front pękł w kilku miejscach. ${p.manager} twierdzi, że sytuacja jest pod kontrolą, jak każdy przed katastrofą.`,p=>`${p.team} straciło teren. Generał ${p.manager} ma tydzień na reorganizację.`],
  awful:[p=>`To nie była bitwa. To była rzeź. ${p.manager} wrócił z GW bez punktów honoru i z rannym ego.`,p=>`${p.team} zostało rozbite, a sztab ${p.manager} pali mapy, żeby nikt nie zobaczył planu.`,p=>`Dowództwo straciło kontakt z rzeczywistością. ${p.manager} prosi o posiłki w postaci wildcarda.`,p=>`Raport z frontu ${p.team}: katastrofa. Jeńców brak, punktów też niewiele.`]
 },
 { // 5 - weather
  great:[p=>`Nad ${p.team} pełne słońce. ${p.manager} złapał punktowy wyż i chwilowo nie widać żadnego frontu katastrofalnych decyzji.`,p=>`Prognoza dla ${p.manager}: zielone strzałki, wysokie ciśnienie i lokalne opady samozachwytu.`,p=>`W ${p.team} bezchmurnie. Wynik ogrzał tabelę lepiej niż lipcowe słońce.`,p=>`${p.manager} trafił na idealne warunki punktowe. Meteorolodzy ostrzegają tylko przed nadmierną pewnością siebie.`],
  good:[p=>`Pogoda w ${p.team} sprzyjająca: sporo punktowego słońca, pojedyncze chmury na ławce.`,p=>`${p.manager} uniknął burzy. Weekend przyjemny, bez konieczności chowania się przed tabelą.`,p=>`Nad ${p.team} lekki wyż. Nie upał, ale można spokojnie wyjść bez parasola transferowego.`,p=>`Prognoza ${p.manager}: stabilnie i dodatnio. Burze możliwe dopiero przed deadlinem.`],
  neutral:[p=>`Nad ${p.team} zachmurzenie umiarkowane. Ani słońce, ani ulewa, po prostu szary FPL-owy dzień.`,p=>`${p.manager} dostał pogodę typu „meh”. Można przeżyć, nie ma czego fotografować.`,p=>`Ciśnienie punktowe w normie. ${p.team} bez anomalii, co samo w sobie jest anomalią.`,p=>`Prognoza: przeciętnie. ${p.manager} może schować zarówno okulary przeciwsłoneczne, jak i parasol.`],
  bad:[p=>`Nad ${p.team} nadciągnął front czerwonych strzałek. ${p.manager} został ostrzeżony, ale i tak wyszedł bez kurtki.`,p=>`Weekend ${p.manager} to deszcz, wiatr i lokalne podtopienia na ławce.`,p=>`Meteorolodzy potwierdzają: w ${p.team} było chujowo i nie jest to kwestia modelu pogodowego.`,p=>`Ciśnienie spadło razem z rankingiem. ${p.manager} powinien unikać gwałtownych ruchów atmosferycznych.`],
  awful:[p=>`Dla ${p.team} wydano czerwony alert. ${p.manager} powinien zostać w domu i nie zbliżać się do transferów.`,p=>`Huragan blanków przeszedł przez skład ${p.manager}. Zostały gruzy, bench points i pytania.`,p=>`Prognoza po GW: katastrofalna. ${p.team} wygląda jak po przejściu tornada z opaską kapitana.`,p=>`IMGW FPL ostrzega przed ${p.manager}: możliwe kolejne gwałtowne decyzje po weekendowej nawałnicy.`]
 },
 { // 6 - crime/noir
  great:[p=>`${p.manager} opuścił miejsce zdarzenia z pełnymi kieszeniami punktów. Policja na razie nie znalazła podstaw do zatrzymania.`,p=>`W ${p.team} dokonano punktowego skoku stulecia. ${p.manager} twierdzi, że wszystko było legalne.`,p=>`Detektywi przejrzeli wynik ${p.manager}. Podejrzanie dobry, ale brak dowodów na oszustwo.`,p=>`${p.team} wyszło z weekendu bogatsze o punkty. Monitoring pokazuje ${p.manager} uśmiechającego się bezczelnie.`],
  good:[p=>`Śledztwo w ${p.team} nie wykazało większych przestępstw przeciwko logice. ${p.manager} może iść do domu.`,p=>`${p.manager} miał czysty weekend. Kilka drobnych wykroczeń, żadnego kryminału.`,p=>`Policja FPL zamknęła sprawę ${p.team} z braku dowodów na głupotę kwalifikowaną.`,p=>`Kartoteka ${p.manager} po tej GW wygląda zaskakująco niewinnie.`],
  neutral:[p=>`Detektyw spojrzał na wynik ${p.team} i uznał, że szkoda czasu. Zwykła przeciętność, bez znamion przestępstwa.`,p=>`${p.manager} pozostaje osobą zainteresowania, ale ta kolejka nie dostarczyła nowych dowodów.`,p=>`Monitoring ${p.team} nic ciekawego nie zarejestrował. Rutynowa GW.`,p=>`Sprawa ${p.manager} utknęła. Brak spektakularnych zbrodni, brak spektakularnych sukcesów.`],
  bad:[p=>`Na miejscu zbrodni znaleziono ławkę pełną punktów i ślady panicznych transferów. ${p.manager} odmawia komentarza.`,p=>`Detektywi pytają ${p.manager}, dlaczego tyle punktów zniknęło. Odpowiedź „FPL” nie wystarcza.`,p=>`${p.team} trafiło do kartoteki po weekendzie pełnym podejrzanych decyzji.`,p=>`Policja zabezpieczyła telefon ${p.manager}. Historia transferów ma zostać zbadana przez biegłych.`],
  awful:[p=>`To miejsce zbrodni. ${p.team} otoczono taśmą, a ${p.manager} jest głównym podejrzanym.`,p=>`Śledczy weszli do siedziby ${p.team} o świcie. Skala punktowych strat wymagała natychmiastowej interwencji.`,p=>`${p.manager} został zatrzymany do wyjaśnienia. Zarzut: seryjne znęcanie się nad własnym rankingiem.`,p=>`W aktach sprawy ${p.team} widnieje adnotacja: „nie pokazywać dzieciom historii tej GW”.`]
 },
 { // 7 - football pundit
  great:[p=>`${p.manager} wygrał dziś taktycznie wszystko, co było do wygrania. Eksperci szukają słabszego punktu, ale chwilowo muszą się zamknąć.`,p=>`${p.team} zagrało fantasy football na wysokim poziomie. Dobór składu, kapitan, timing — wszystko się zgadzało.`,p=>`To był menedżerski masterclass ${p.manager}. Tak, powiedzieliśmy to i już żałujemy, bo ego zaraz urośnie.`,p=>`${p.manager} przeczytał tę kolejkę lepiej niż większość ligi. Studio nie ma dziś łatwego roastu.`],
  good:[p=>`${p.manager} dobrze zarządził zasobami. Nie genialnie, ale wystarczająco, żeby ${p.team} wyszło na plus.`,p=>`Eksperci chwalą selekcję ${p.team}. Kilka decyzji siadło, żadna nie wysadziła kolejki.`,p=>`${p.manager} zagrał bezpiecznie i skutecznie. Czasem to właśnie jest najmądrzejsze.`,p=>`W studiu zgodność: ${p.team} zrobiło dobrą robotę. Kontrowersji brak, nuda dla telewizji.`],
  neutral:[p=>`Eksperci nie mogą dojść do wniosku, czy ${p.manager} zrobił coś dobrze, czy po prostu niczego mocno nie zepsuł.`,p=>`${p.team} zakończyło weekend bez wyraźnej narracji. Klasyczne 6/10.`,p=>`Analiza ${p.manager}: kilka plusów, kilka minusów, końcowo wielkie „no dobra”.`,p=>`Studio nie ma się o co kłócić. To mówi wszystko o tej kolejce ${p.team}.`],
  bad:[p=>`Eksperci są zgodni: ${p.manager} źle odczytał kolejkę. I nie, nie da się wszystkiego zwalić na variance.`,p=>`${p.team} miało problemy w selekcji, captaincy i chyba również komunikacji z rzeczywistością.`,p=>`Studio pyta, co ${p.manager} chciał osiągnąć. Odpowiedzi nadal brak.`,p=>`To był słaby performance menedżerski. Bez eufemizmów, bez expected bullshit.`],
  awful:[p=>`Eksperci rozłożyli kolejkę ${p.manager} na czynniki pierwsze i żadna część nie wygląda dobrze.`,p=>`${p.team} było dziś antyreklamą zarządzania FPL. Materiał do kursu „czego nie robić”.`,p=>`Studio przerwało analizę, bo zaczęło robić się zwyczajnie przykro. ${p.manager} został sam z wynikiem.`,p=>`To był taktyczny wpierdol. ${p.manager} nie ma dziś żadnej linii obrony.`]
 },
 { // 8 - tabloid
  great:[p=>`SZOK! ${p.manager} jednak umie grać w FPL. Sąsiedzi ${p.team} potwierdzają, że świętowanie trwało do późna.`,p=>`TYLKO U NAS: ${p.manager} zdobywa masę punktów i natychmiast zaczyna chodzić jak celebryta.`,p=>`NIEWIARYGODNE! ${p.team} bez kompromitacji. Redakcja sprawdza, czy to na pewno właściwe konto.`,p=>`PILNE: ${p.manager} wygrywa kolejkę. Internet pyta, kiedy sodówka uderzy do głowy.`],
  good:[p=>`DOBRA WIADOMOŚĆ dla fanów ${p.team}: ${p.manager} tym razem nie zepsuł weekendu.`,p=>`FANI W SZOKU! Solidny wynik ${p.manager} i żadnej afery transferowej.`,p=>`NASZE ŹRÓDŁA: w domu ${p.manager} panuje spokój po przyzwoitej GW.`,p=>`EKSKLUZYWNE: ${p.team} punktuje, a menedżer nie musi się tłumaczyć. Rzadki widok.`],
  neutral:[p=>`NUDA! ${p.manager} zalicza kolejkę, o której jutro nikt nie będzie pamiętał.`,p=>`BEZ SENSACJI: ${p.team} ani nie zachwyca, ani nie kompromituje.`,p=>`FANI OBOJĘTNI po przeciętnym wyniku ${p.manager}.`,p=>`BRAK DRAMY w ${p.team}. Redakcja zmuszona pisać o czymś innym.`],
  bad:[p=>`SKANDAL w ${p.team}! ${p.manager} odpowiada na trudne pytania po słabym wyniku.`,p=>`FANI WŚCIEKLI! ${p.manager} tłumaczy się z kolejnego weekendu do zapomnienia.`,p=>`TYLKO U NAS: historia decyzji ${p.manager}, której sam menedżer wolałby już nie widzieć.`,p=>`ALARM w ${p.team}. Czerwone strzałki i rosnąca presja na trenera.`],
  awful:[p=>`KATASTROFA! ${p.manager} demoluje własny ranking. Kibice ${p.team} żądają odpowiedzi.`,p=>`DRAMAT W RODZINIE FPL! Wynik ${p.manager} tak zły, że sąsiedzi słyszeli przekleństwa.`,p=>`SZOKUJĄCE SCENY w ${p.team}. Menedżer opuszcza konferencję pod eskortą własnego wstydu.`,p=>`NAJGORSZY WEEKEND? ${p.manager} zapisuje się w historii z bardzo niewłaściwego powodu.`]
 },
 { // 9 - therapist
  great:[p=>`Terapeuta pogratulował ${p.manager}: pierwszy weekend od dawna, po którym może mówić o FPL bez zaciskania szczęki.`,p=>`${p.manager} przepracował lęk przed deadlinem i dostał w nagrodę punkty. ${p.team} oddycha.`,p=>`Sesja po dobrej GW była krótka. ${p.manager} głównie opowiadał, jak świetnie wszystko przewidział.`,p=>`Zdrowie psychiczne w ${p.team} poprawiło się gwałtownie wraz z wynikiem. Ciekawe zjawisko.`],
  good:[p=>`${p.manager} zrobił postęp. Nie sprawdzał tabeli co trzy minuty i nawet zdobył punkty.`,p=>`Terapeuta ocenia tydzień ${p.team} pozytywnie. Mniej impulsywnych ruchów, mniej cierpienia.`,p=>`${p.manager} nauczył się akceptować pojedynczy blank bez natychmiastowej sprzedaży zawodnika.`,p=>`W ${p.team} zdrowa kolejka. Bez skrajności, bez ataków paniki.`],
  neutral:[p=>`Sesja ${p.manager} przebiegła spokojnie. Nie ma euforii, nie ma rozpaczy. Terapeuta zadowolony, redakcja znudzona.`,p=>`${p.team} osiągnęło emocjonalny remis. Wynik ani nie leczy, ani nie traumatyzuje.`,p=>`${p.manager} mówi, że „jest okej”. Tym razem brzmi to nawet wiarygodnie.`,p=>`Kolejka bez wielkich emocji. To może być najzdrowszy weekend ${p.manager}.`],
  bad:[p=>`${p.manager} wrócił na terapię z klasycznym zdaniem: „wszystko wyglądało dobrze przed deadlinem”.`,p=>`Terapeuta zabronił ${p.manager} podejmowania transferów w stanie złości.`,p=>`${p.team} aktywowało stare traumy: bench points, captain blank i czerwone strzałki.`,p=>`${p.manager} ćwiczy dziś akceptację faktu, że nie cofnie sobotniego deadline'u.`],
  awful:[p=>`Sesja ${p.manager} została przedłużona o godzinę. Wynik wymagał interwencji specjalisty.`,p=>`${p.team} stworzyło nową traumę. Terapeuta poprosił o screenshoty, bo nie uwierzył na słowo.`,p=>`${p.manager} przeszedł wszystkie pięć etapów żałoby jeszcze przed końcem niedzielnych meczów.`,p=>`Diagnoza: ostre FPL. Zalecenie: nie otwierać aplikacji do środy.`]
 },
 { // 10 - casino
  great:[p=>`${p.manager} wyszedł z kasyna FPL na plusie. Krupier patrzy krzywo, ale punkty są już na koncie.`,p=>`${p.team} trafiło jackpot. ${p.manager} zapewnia, że to skill, nie hazard.`,p=>`Ruletka kapitańska zatrzymała się na właściwym nazwisku. ${p.manager} zgarnia żetony.`,p=>`Kasyno dziś przegrało z ${p.manager}. Rzadkość, którą warto celebrować.`],
  good:[p=>`${p.manager} zakończył weekend z umiarkowanym zyskiem. Nie jackpot, ale drink przy stole się należy.`,p=>`${p.team} grało ostrożnie i wyszło na plus. Krupier nie dostał napiwku.`,p=>`Kilka zakładów ${p.manager} weszło. Portfel punktowy wygląda zdrowo.`,p=>`Kasyno FPL oddało trochę punktów ${p.team}. Na razie bez podejrzeń.`],
  neutral:[p=>`${p.manager} wyszedł mniej więcej na zero. Cały weekend emocji po to, żeby wrócić do punktu wyjścia.`,p=>`Stół FPL nie dał dziś ani wygranej, ani bankructwa. ${p.team} zabiera żetony dalej.`,p=>`${p.manager} grał, ale kasyno nawet nie zauważyło.`,p=>`Bilans ${p.team}: remis z krupierem. Nikt nie klaszcze.`],
  bad:[p=>`Kasyno zabrało ${p.manager} więcej, niż powinno. Problem: część żetonów oddał dobrowolnie za hity.`,p=>`${p.team} obstawiało źle. Krupier dziękuje za współpracę.`,p=>`${p.manager} próbował odrobić straty i prawie zrobił kolejne transfery. Ochrona interweniowała.`,p=>`Ruletka kapitańska znów zatrzymała się na polu „blank”. ${p.manager} patrzy w pustkę.`],
  awful:[p=>`${p.manager} przegrał w kasynie FPL koszulę, ranking i resztki cierpliwości.`,p=>`Ochrona wyprowadziła ${p.manager} od stołu po serii decyzji, które wyglądały jak tilt.`,p=>`${p.team} zbankrutowało punktowo. Krupier nawet nie musiał oszukiwać.`,p=>`Kasyno FPL wysłało ${p.manager} kartę VIP. Takich klientów się nie wypuszcza.`]
 },
 { // 11 - school
  great:[p=>`${p.manager} zdał GW na piątkę. ${p.team} może dziś pokazać świadectwo rodzicom.`,p=>`Nauczyciel FPL wpisał ${p.manager} ocenę bardzo dobrą. Bez ściągania z template'u.`,p=>`${p.team} odrobiło pracę domową i jeszcze dostało punkty za aktywność.`,p=>`${p.manager} siedzi dziś w pierwszej ławce i wyjątkowo zna odpowiedzi.`],
  good:[p=>`${p.manager} zaliczył sprawdzian. Nie olimpijczyk, ale spokojnie przechodzi dalej.`,p=>`${p.team} dostało czwórkę. Solidnie, bez uwag w dzienniczku.`,p=>`Nauczyciel chwali ${p.manager} za przygotowanie. Rodzice nie zostali wezwani.`,p=>`${p.team} zrobiło zadanie poprawnie. Kilka błędów, ale wynik się broni.`],
  neutral:[p=>`${p.manager} dostał trójkę. Typowa ocena: „stać cię na więcej”.`,p=>`${p.team} zaliczyło na słowo honoru. Nikt nie będzie oprawiał tego sprawdzianu.`,p=>`W dzienniku ${p.manager} pojawiło się „dostateczny”. Najbardziej brutalne słowo przeciętności.`,p=>`Nauczyciel spojrzał na wynik ${p.team} i napisał: „pracuj dalej”.`],
  bad:[p=>`${p.manager} oblał kartkówkę z captaincy i selekcji. Poprawa za tydzień.`,p=>`Rodzice ${p.team} zostali wezwani do szkoły. Powód: niepokojące decyzje menedżera.`,p=>`${p.manager} dostał dwóję i uwagę: „przeszkadza sam sobie”.`,p=>`Nauczyciel FPL pyta, czy ${p.manager} w ogóle przeczytał pytania przed deadlinem.`],
  awful:[p=>`${p.manager} dostał pałę z GW. Bez prawa poprawy do następnego weekendu.`,p=>`Dyrektor szkoły wezwał ${p.manager}. ${p.team} ma poważne problemy z zachowaniem i punktami.`,p=>`Sprawdzian ${p.manager} został pokazany klasie jako przykład, czego nie robić.`,p=>`${p.team} nie zdało. Korepetytor od FPL już wysłał cennik.`]
 },
 { // 12 - cooking
  great:[p=>`${p.manager} ugotował dziś świetną GW. Skład doprawiony, kapitan trafiony, nic się nie przypaliło.`,p=>`Kuchnia ${p.team} wydała danie dnia. Nawet Michelin FPL byłoby pod wrażeniem.`,p=>`${p.manager} trafił proporcje idealnie. Zero surowych blanków, dużo punktowego smaku.`,p=>`Dziś ${p.team} serwowało punkty na gorąco. Szef kuchni ${p.manager} może wyjść do gości.`],
  good:[p=>`Danie ${p.manager} wyszło dobrze. Może nie fine dining, ale nikt nie wyszedł głodny.`,p=>`${p.team} podało solidną porcję punktów. Kuchnia działa.`,p=>`Szef ${p.manager} nie przekombinował przepisu. I właśnie dlatego smakowało.`,p=>`Weekend ${p.team}: dobre składniki, rozsądne proporcje, zero zatrucia transferowego.`],
  neutral:[p=>`${p.manager} ugotował coś jadalnego. Nikt nie prosi o dokładkę.`,p=>`Kuchnia ${p.team} podała przeciętność z dodatkiem lekkiego rozczarowania.`,p=>`Danie poprawne technicznie, pozbawione emocji. ${p.manager} wzrusza ramionami.`,p=>`${p.team} nie przypaliło obiadu, ale też nikt nie pyta o przepis.`],
  bad:[p=>`${p.manager} przesolił transfery i spalił kapitana. Kuchnia ${p.team} ma ciężki wieczór.`,p=>`Szef ${p.manager} twierdzi, że przepis był dobry. Goście pokazują wynik i proszą o rachunek.`,p=>`${p.team} podało blanki w trzech odsłonach. Krytycy nie zostawili napiwku.`,p=>`Kuchnia wygląda jak po awarii. ${p.manager} próbuje ratować danie transferowym ketchupem.`],
  awful:[p=>`${p.manager} spalił nawet wodę. ${p.team} powinno zostać zamknięte przez sanepid FPL.`,p=>`Goście ${p.team} wyszli głodni i wkurwieni. Szef kuchni ukrywa się na zapleczu.`,p=>`To nie było danie, tylko przestępstwo kulinarne przeciwko rankingowi.`,p=>`${p.manager} dostał zakaz zbliżania się do kuchenki i przycisku Confirm Transfers.`]
 },
 { // 13 - engineering
  great:[p=>`${p.manager} zbudował w tej GW konstrukcję, która nie tylko stoi, ale jeszcze wygląda cholernie solidnie.`,p=>`Projekt ${p.team} przeszedł wszystkie testy obciążeniowe. Inżynier ${p.manager} może podpisać odbiór.`,p=>`System ${p.team} działa zgodnie ze specyfikacją. Nikt nie wie, jak długo, ale dziś działa.`,p=>`${p.manager} dostarczył wersję produkcyjną bez krytycznych bugów. Święto.`],
  good:[p=>`Projekt ${p.team} jest stabilny. Kilka drobnych usterek, zero awarii krytycznych.`,p=>`${p.manager} dowiózł build, który przechodzi testy. QA nie zgłasza blockerów.`,p=>`Konstrukcja trzyma. Nie trzeba refaktoryzować połowy składu.`,p=>`${p.team} działa wystarczająco dobrze, żeby nikt nie otwierał emergency change.`],
  neutral:[p=>`System ${p.team} działa. Nie szybko, nie pięknie, ale bez crasha.`,p=>`${p.manager} wypuścił wersję „works on my machine”. Ranking nie protestuje, ale też nie klaszcze.`,p=>`Projekt stoi w miejscu. Brak regresji, brak feature'ów.`,p=>`Build ${p.team} zielony, ale coverage emocji bliskie zeru.`],
  bad:[p=>`Produkcja ${p.team} sypie błędami. ${p.manager} twierdzi, że to edge case. Ranking twierdzi inaczej.`,p=>`QA zgłosiło blocker: decyzje ${p.manager}. Priorytet krytyczny.`,p=>`${p.team} wymaga hotfixa, ale każdy hotfix kosztuje punkty. Piękna architektura.`,p=>`${p.manager} wdrożył zmianę bez testów. Produkcja odpowiedziała czerwonym arrowem.`],
  awful:[p=>`System ${p.team} padł na produkcji. ${p.manager} pyta, czy można zrobić rollback do piątku.`,p=>`Critical incident. Root cause analysis wskazuje na użytkownika ${p.manager}.`,p=>`${p.team} ma więcej blockerów niż punktów. DevOps odłączył telefon.`,p=>`Postmortem tej GW będzie długi. Pierwszy wniosek: nie deployować menedżera przed deadlinem.`]
 },
 { // 14 - religion/cult light, no protected group attacks
  great:[p=>`${p.manager} doznał dziś objawienia punktowego. W ${p.team} wierzą, że cuda jednak istnieją.`,p=>`Świątynia FPL wysłuchała modlitw ${p.manager}. Punkty spadły z nieba.`,p=>`${p.team} przeżyło błogosławioną kolejkę. Nawet kapitan nie zdradził.`,p=>`${p.manager} przez tydzień będzie głosił ewangelię własnych decyzji.`],
  good:[p=>`Los był łaskawy dla ${p.team}. ${p.manager} nie potrzebował nawet rytuału wildcardowego.`,p=>`${p.manager} dostał solidną porcję punktowej łaski.`,p=>`W ${p.team} panuje wiara w projekt. Tym razem ma nawet podstawy.`,p=>`Modlitwy o zieloną strzałkę zostały częściowo wysłuchane.`],
  neutral:[p=>`FPL-owi bogowie pozostali obojętni wobec ${p.manager}. Typowa przeciętność.`,p=>`${p.team} nie dostało ani błogosławieństwa, ani klątwy.`,p=>`${p.manager} czeka na znak. Tabela milczy.`,p=>`Kolejka bez cudów. I bez plag, więc można brać.`],
  bad:[p=>`${p.manager} pyta, za jakie grzechy dostał tę kolejkę. Redakcja ma kilka teorii.`,p=>`Nad ${p.team} zawisła klątwa blanków. Główny egzorcysta jest jednocześnie menedżerem.`,p=>`Modlitwy ${p.manager} odbiły się od sufitu. Punkty nie przyszły.`,p=>`${p.team} potrzebuje odkupienia, najlepiej w następnej GW.`],
  awful:[p=>`To była biblijna plaga FPL. ${p.manager} przeżył, ranking niekoniecznie.`,p=>`${p.team} zostało ukarane serią blanków o niemal metafizycznej skali.`,p=>`${p.manager} szuka sensu cierpienia. FPL odpowiada: „bo możesz”.`,p=>`Egzorcyzm składu zaplanowano na środę. Wildcard trzymany w pogotowiu.`]
 },
 { // 15 - racing
  great:[p=>`${p.manager} przejechał GW na pole position. ${p.team} miało tempo, strategię i zero pit stopów z paniki.`,p=>`Flaga w szachownicę dla ${p.manager}. Punkty dowiezione bez kolizji.`,p=>`${p.team} było dziś najszybsze na torze FPL. Rywale oglądali tylne skrzydło.`,p=>`${p.manager} trafił strategię opon i kapitana. Weekend wyścigowy idealny.`],
  good:[p=>`${p.manager} finiszował wysoko. Bez zwycięstwa, ale z solidnymi punktami konstruktorów.`,p=>`${p.team} miało dobry pace. Strategia nie zepsuła wyścigu, co już jest sukcesem.`,p=>`Weekend ${p.manager}: czysto, szybko, bez głupiego pit stopu.`,p=>`${p.team} dowiozło wynik w punktach. Garaż spokojny.`],
  neutral:[p=>`${p.manager} przejechał wyścig w środku stawki. Kamery rzadko go pokazywały.`,p=>`${p.team} miało tempo na P8. Dokładnie tak ekscytujące, jak brzmi.`,p=>`Bez awarii, bez podium. ${p.manager} zbiera punkty i jedzie dalej.`,p=>`Strategia poprawna, tempo przeciętne. Weekend do archiwum.`],
  bad:[p=>`${p.manager} zjechał do boksu w najgorszym możliwym momencie. FPL nie dało safety cara.`,p=>`${p.team} miało słaby pace i jeszcze gorszą strategię.`,p=>`Pit wall ${p.manager} pomylił się kilka razy. Ranking płaci za paliwo.`,p=>`${p.team} wypadło poza punkty. Inżynierowie analizują, menedżer przeklina.`],
  awful:[p=>`${p.manager} rozbił bolid na pierwszym zakręcie GW i potem tylko patrzył, jak inni punktują.`,p=>`${p.team} zaliczyło DNF rankingowe. Strategia skończyła w bandzie.`,p=>`Garaż ${p.manager} milczy. Telemetria pokazuje katastrofę od startu do mety.`,p=>`Czerwona flaga dla ${p.team}. Trzeba posprzątać fragmenty składu z toru.`]
 }
];

const VOICE_QUOTES=[
 ["„Dzisiaj wynik mówi za mnie, więc wyjątkowo nie muszę wymyślać mądrych teorii.”","„Nie chcę robić z jednej kolejki autobiografii geniusza.”","„Największe zagrożenie po dobrym wyniku to uwierzyć, że nagle wszystko wiem.”","„Jak działa, nie dotykaj. Muszę sobie to chyba wytatuować.”"],
 ["„Nie będę składał apelacji od tabeli. Wyrok jest jaki jest.”","„Jeśli decyzja nie broni się punktami, to długi wywód jej nie uratuje.”","„Przyjmuję odpowiedzialność bez wnoszenia o nadzwyczajne złagodzenie kary.”","„Następny deadline będzie moją rozprawą poprawkową.”"],
 ["„Stan psychiczny stabilny, dopóki nie otworzę zakładki Transfers.”","„Najlepszym lekarstwem byłoby kilka zielonych strzałek z rzędu.”","„Mam zakaz samodzielnego diagnozowania składu po jednym blanku.”","„Leczenie trwa. Rokowania zależą od mojego palca.”"],
 ["„Nie będę mówił o synergii, roadmapie ani innych korporacyjnych bzdurach. Chcę punktów.”","„KPI jest prosty: przestać oddawać punkty za głupotę.”","„Nie planuję restrukturyzacji całego składu po jednym słabym kwartale.”","„Akcjonariusze mogą spać spokojnie, dopóki ja nie zacznę kombinować.”"],
 ["„Rozkaz na kolejny tydzień: utrzymać pozycje i nie strzelać sobie w stopę.”","„Nie potrzebuję bohaterów. Potrzebuję ludzi, którzy wykonają zadanie.”","„Najgorszy wróg jest wewnętrzny i ma dostęp do mojego konta.”","„Dyscyplina przed deadlinem będzie kluczowa.”"],
 ["„Nie kontroluję pogody, ale powinienem trochę lepiej kontrolować własne transfery.”","„Jeżeli znowu zobaczę burzę blanków, nie będę od razu ewakuował całego składu.”","„Potrzebujemy kilku słonecznych tygodni bez gwałtownych ruchów.”","„Ciśnienie spada najbardziej, kiedy sam zaczynam panikować.”"],
 ["„Nie będę zacierał śladów. Historia transferów już wszystko wie.”","„Mam alibi na kilka decyzji, na resztę nie.”","„Najgorsze przestępstwa przeciwko rankingowi popełniałem z premedytacją.”","„Następna kolejka ma być czysta. Bez recydywy.”"],
 ["„Analiza jest prosta: jak zdobywasz mało punktów, grałeś źle. Koniec panelu.”","„Nie mam zamiaru chować się za statystykami zaawansowanymi.”","„Selekcja musi być lepsza, kapitan bardziej oczywisty, ja mniej kreatywny.”","„W następnym studiu chcę być chwalony, nie analizowany jak trup.”"],
 ["„Nagłówki mogą pisać co chcą, byle tabela zaczęła pisać coś przyjemniejszego.”","„Nie komentuję plotek o moim zwolnieniu, bo sam jestem zarządem.”","„Fani mają prawo krzyczeć. Ja mam obowiązek przestać dawać im powody.”","„Następna GW albo mnie wybieli, albo dostarczy wam kolejny front page.”"],
 ["„Muszę zaakceptować, że nie każda zła kolejka wymaga natychmiastowej reakcji.”","„Pracuję nad impulsywnością. Najgorzej idzie mi przy price rise'ach.”","„Nie mogę kontrolować punktów, mogę kontrolować własne głupoty.”","„Następny tydzień traktuję jako ćwiczenie z niedotykania.”"],
 ["„Kończę dziś grę przy stole. Żadnego odrabiania strat transferami.”","„Nie będę podwajał stawki tylko dlatego, że poprzedni zakład nie wszedł.”","„Kasyno zawsze chce, żebym grał dalej. Tym razem idę spać.”","„Żetony punktowe są zbyt drogie na emocjonalne decyzje.”"],
 ["„Następną kartkówkę chcę napisać bez ściągania z Twittera.”","„Wyciągam wnioski, zanim nauczyciel znowu wpisze uwagę.”","„Nie chcę poprawki z captaincy co tydzień.”","„Praca domowa na ten tydzień: cierpliwość i mniej kombinowania.”"],
 ["„Przepis jest prosty: mniej przypraw, więcej punktów.”","„Nie będę ratował spalonego dania kolejnym transferowym sosem.”","„Jak skład smakuje dobrze, nie trzeba wrzucać do niego pięciu nowych składników.”","„Następny serwis ma być spokojniejszy.”"],
 ["„Najpierw testy, potem deployment. Koniec zmian na produkcji w piątek wieczorem.”","„Nie każdy bug wymaga przepisania całej aplikacji.”","„Mam zamiar ograniczyć hotfixy za -4.”","„Jeśli coś działa, nie refaktoryzuję tego przed deadlinem.”"],
 ["„Nie oczekuję cudu, wystarczy kilka normalnych decyzji.”","„Następnym razem mniej modlitwy, więcej rozsądku.”","„Nie będę traktował price rise'a jak znaku z nieba.”","„Wiara w projekt zostaje, fanatyzm transferowy odpada.”"],
 ["„Strategię na następny wyścig upraszczamy. Mniej pit stopów, więcej tempa.”","„Nie chcę znowu przegrywać GW w garażu.”","„Tempo jest ważniejsze niż desperacki undercut na transferach.”","„Następny weekend chcę zakończyć na mecie, nie w bandzie.”"]
];

function pressQuote(p,gw,managerIndex,league){
 const mood=conferenceMood(p,league);
 const voice=MANAGER_VOICES[managerIndex % MANAGER_VOICES.length];
 const variants=voice[mood];
 const v=(gw-1)%variants.length;
 const intro=variants[v](p);
 const quote=VOICE_QUOTES[managerIndex % VOICE_QUOTES.length][(gw-1)%4];
 const rank=gwRank(p,league);
 const statSentence=[
   `${p.manager} kończy GW${gw} na ${rank}. miejscu kolejki z ${p.gwPoints} pkt; forma ostatnich trzech to ${p.avg3}.`,
   `Bilans tej konkretnej GW dla ${p.team}: ${p.gwPoints} punktów i ${rank}. wynik w lidze.`,
   `Tablica po GW${gw}: ${p.manager} — ${p.gwPoints} pkt, pozycja w kolejce ${rank}, bench season ${p.benchSeason}.`,
   `Liczby przed kolejnym deadlinem: ${p.gwPoints} w GW${gw}, miejsce ${rank}, koszt hitów sezonu ${p.hitSeason}.`
 ][(gw+managerIndex)%4];
 return `„${intro} ${statSentence} ${quote}”`;
}

function pressReaction(p,gw,managerIndex,league){
 const mood=conferenceMood(p,league);
 const reactions=[
   {
    great:`Redakcja: ${p.manager} może dziś kozaczyć. Byle nie zaczął wierzyć, że odkrył kod źródłowy FPL.`,
    good:`Redakcja: solidna robota ${p.manager}. Największym zagrożeniem pozostaje następny własny pomysł.`,
    neutral:`Redakcja: ${p.manager} ani bohater, ani oskarżony. Sprawa wraca za tydzień.`,
    bad:`Redakcja: ${p.manager} ma tydzień na poprawę, zanim żarty zaczną pisać się całkowicie same.`,
    awful:`Redakcja: w sprawie ${p.manager} zabezpieczono dowody. Niektóre screeny mogą być drastyczne.`
   },
   {
    great:`Redakcja: sąd FPL uniewinnia ${p.manager}. Wyrok nieprawomocny do następnej GW.`,
    good:`Redakcja: akt oskarżenia wobec ${p.manager} trafia dziś do szuflady.`,
    neutral:`Redakcja: postępowanie zawieszone. Brak wystarczającej liczby punktowych dowodów.`,
    bad:`Redakcja: prokurator już ostrzy ołówek. ${p.manager} powinien uważać.`,
    awful:`Redakcja: obrona ${p.manager} prosi o zmianę tematu. Wniosek oddalony.`
   },
   {
    great:`Redakcja: pacjent ${p.manager} wypisany w dobrym stanie. Kontrola po następnym deadlinie.`,
    good:`Redakcja: parametry ${p.manager} stabilne. Zalecamy nie eksperymentować.`,
    neutral:`Redakcja: stan ${p.manager} bez zmian. Obserwacja trwa.`,
    bad:`Redakcja: ${p.manager} wymaga odpoczynku od przycisku Transfers.`,
    awful:`Redakcja: oddział intensywnej terapii rankingu gotowy na przyjęcie ${p.manager}.`
   }
 ];
 const set=reactions[managerIndex%reactions.length];
 return set[mood];
}

export default function FPLPage(){

 const [data,setData]=useState(null),[error,setError]=useState(""),[tab,setTab]=useState("gazeta"),[profile,setProfile]=useState(null);
 async function load(){
   setError("");
   try{
     const r=await fetch(`/api/fpl?t=${Date.now()}`,{cache:"no-store"});
     const j=await r.json();
     if(!j.ok) throw new Error(j.error||"Błąd FPL");
     setData(j);
   }catch(e){setError(e.message)}
 }
 useEffect(()=>{
   const params = new URLSearchParams(window.location.search);
   if(params.get("tab")==="zaklady") setTab("zaklady");

   load();

   const i=setInterval(load,5*60*1000);
   const v=()=>document.visibilityState==="visible"&&load();
   document.addEventListener("visibilitychange",v);

   return()=>{
     clearInterval(i);
     document.removeEventListener("visibilitychange",v);
   };
 },[]);
 const profileData=useMemo(()=>data?.grades?.find(x=>x.entry===profile),[data,profile]);
 return <>
   <div className="sideHero sideHeroPep" aria-hidden="true" />
   <div className="sideHero sideHeroCherki" aria-hidden="true" />
   <main className="shell fplPage">
   <nav className="topNav"><Link href="/fpl">📰 Kolejnik</Link><strong>FPLowa</strong><button onClick={load}>Odśwież</button></nav>
   <section className="newspaperHero"><div><span className="paperKicker">FPLowa • GW {data?.gw??"—"} {data?(data.gwFinished?"• WYDANIE KOŃCOWE":"• LIVE"):""}</span><h1>📰 FPLOWA</h1><p>Brukowiec, centrum dowodzenia i kronika kompromitacji Waszej ligi.</p>{data?.updatedAt&&<small className="fplUpdated">Aktualizacja: {new Date(data.updatedAt).toLocaleString("pl-PL")}</small>}</div></section>
   <div className="fplTabs">
     <button className={tab==="zaklady"?"active":""} onClick={()=>setTab("zaklady")}>🎲 Zakłady</button>
     {[["gazeta","📰 Gazeta"],["live","⚡ Live"],["profile","👤 Profile"],["historia","🏛️ Hall of Shame"],["analityka","🧠 Analityka"],["muzeum","🏛️ Muzeum"],["studio","📺 Studio"],["rywalizacja","🥊 Rivalry"],["gala","🏆 Awards"]].map(([k,l])=><button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>{l}</button>)}
   </div>
   {error&&<div className="error">{error}</div>}{!data&&!error&&<div className="loading">Redakcja zbiera materiały...</div>}
   {tab==="zaklady"&&<BetsTab/>}
   {data&&tab==="gazeta"&&<>
     <section className="awardStrip">{data.awards?.map((a,i)=><div className="awardMini" key={i}><b>{a.icon} {a.name}</b><strong>{a.manager}</strong><small>{a.value}</small></div>)}</section>
     {data.breakingNews?.length>0&&<section className="breaking"><b>🔴 BREAKING NEWS</b><div className="ticker">{data.breakingNews.join(" • ")}</div></section>}
     <section className="articles">{data.articles.map((a,i)=><article className={`newsCard ${i===0?"leadStory":""}`} key={i}><span className="newsTag">{a.tag}</span><h2>{a.title}</h2><p>{a.body}</p></article>)}</section>
     <Standings data={data} onProfile={setProfile}/>
   </>}
   {data&&tab==="live"&&<section className="megaGrid">
     <Card title="⚽ Kogo oglądamy?">{data.watchList.map(x=><p key={x.manager}><b>{x.manager}:</b> {x.active.length?`grają: ${x.active.join(", ")}`:""} {x.remaining.length?` • czekają: ${x.remaining.join(", ")}`:" • wszyscy już zaczęli"}</p>)}</Card>
     {data.deathMatch&&<Card title="💀 Death Match"><h3>{data.deathMatch.a.manager} {data.deathMatch.a.points} : {data.deathMatch.b.points} {data.deathMatch.b.manager}</h3><p><b>{data.deathMatch.a.manager} różnice:</b> {data.deathMatch.a.unique.join(", ")||"brak"}</p><p><b>{data.deathMatch.b.manager} różnice:</b> {data.deathMatch.b.unique.join(", ")||"brak"}</p></Card>}
     <Card title="🎰 Szanse na wygranie GW"><small>Orientacyjna zabawa na podstawie aktualnych punktów i liczby nierozpoczętych zawodników — nie model bukmacherski.</small>{data.gwChances.map(x=><div className="chance" key={x.manager}><span>{x.manager} • {x.points} pkt • zostało {x.remaining}</span><b>{x.chance}%</b></div>)}</Card>
     <Card title="🧮 Co musi się stać?">{data.deathMatch?<p>{data.deathMatch.a.manager} i {data.deathMatch.b.manager} dzieli tylko <b>{data.deathMatch.gap} pkt</b>. Największe znaczenie będą miały różnice składów pokazane wyżej.</p>:<p>Brak bliskiej walki.</p>}</Card>
     <Card title="🔮 Typy redakcji"><p><b>{data.predictions.label}</b></p><p>Typ na mocny wynik: <b>{data.predictions.winner?.manager}</b> ({data.predictions.winner?.avg3} średnio z ostatnich 3 GW).</p><p>Kandydat do wpierdolu: <b>{data.predictions.danger?.manager}</b> ({data.predictions.danger?.avg3}).</p></Card>
     <Card title="💰 Wirtualne kursy na mistrza"><small>Tylko zabawowa symulacja, bez prawdziwych zakładów.</small>{data.virtualOdds.map(x=><div className="chance" key={x.manager}><span>{x.manager} • {x.prob}%</span><b>{x.odds}</b></div>)}</Card>
   </section>}
   {data&&tab==="profile"&&<><section className="profileGrid">{data.grades.map(x=><button className="profileCard" key={x.entry} onClick={()=>setProfile(x.entry)}><div className="profileIcon">{x.icon}</div><span>{x.label}</span><h3>{x.manager}</h3><p>{x.team}</p><b>{x.editorial}/10</b><small>{x.form}</small></button>)}</section>{profileData&&<Profile p={profileData} close={()=>setProfile(null)}/>}</>}
   {data&&tab==="historia"&&<section className="megaGrid">
     <Card title="🏅 Hall of Shame">
       {data.hallOfShame.length
         ? data.hallOfShame.map((x,i)=><div className="record shameRecord" key={i}><b>{x.kind}</b><strong>{x.manager} — {x.value}</strong><small>{x.team}</small></div>)
         : <p>Jeszcze za mało zakończonych kolejek, żeby uczciwie kogoś publicznie upokorzyć.</p>}
     </Card>
     <Card title="📊 Power Ranking — forma 3 GW">
       {[...data.managerProfiles].sort((a,b)=>b.avg3-a.avg3).map((x,i)=><div className="chance" key={x.entry}><span>#{i+1} {x.icon} {x.manager} • {x.form}</span><b>{x.avg3}</b></div>)}
     </Card>
   </section>}
   {data&&tab==="analityka"&&<section className="megaGrid">
     <Card title="🧠 IQ transferowe">
       {data.transferIQRanking.map((x,i)=><div className="chance" key={x.entry}><span>#{i+1} {x.manager}</span><b className={x.score>=0?"positive":"negative"}>{x.score>0?"+":""}{x.score}</b></div>)}
     </Card>
     <Card title="☠️ Najgorszy transfer sezonu">
       {data.worstTransferSeason?<><h3>{data.worstTransferSeason.manager}</h3><p><b>{data.worstTransferSeason.outName}</b> → <b>{data.worstTransferSeason.inName}</b></p><p>Sprzedany: {data.worstTransferSeason.outPoints} pkt • kupiony: {data.worstTransferSeason.inPoints} pkt</p><strong className="negative">{data.worstTransferSeason.delta} pkt</strong></>:<p>Brak transferów do oceny.</p>}
     </Card>
     <Card title="🧠 Najlepszy transfer sezonu">
       {data.bestTransferSeason?<><h3>{data.bestTransferSeason.manager}</h3><p><b>{data.bestTransferSeason.outName}</b> → <b>{data.bestTransferSeason.inName}</b></p><p>Bilans ruchu: <b className="positive">+{data.bestTransferSeason.delta}</b></p></>:<p>Brak danych.</p>}
     </Card>
     <Card title="©️ Captain Roulette">
       {data.captainRanking.map((x,i)=><div className="record" key={x.entry}><b>#{i+1} {x.manager}</b><strong>{x.actual} pkt z kapitanów</strong><small>stracone vs idealny wybór: {x.lost}</small></div>)}
     </Card>
     <Card title="💀 Co gdybyś nic nie robił?"><small>GW1 jest punktem startowym — różnica w GW1 zawsze wynosi 0. Od GW2 porównujemy z zamrożonym składem i kapitanem z GW1.</small>
       {data.noTouchRanking.map(x=><div className="record" key={x.entry}><b>{x.manager}</b><strong>Obecnie {x.actual} • GW1 bez zmian {x.untouched}</strong><small className={x.managerImpact>=0?"positive":"negative"}>wkład menedżera: {x.managerImpact>0?"+":""}{x.managerImpact}</small></div>)}
     </Card>
     <Card title="📅 Manager / Fraud of the Month">
       {data.monthlyAwards.map(x=><div className="monthAward" key={x.month}><b>{x.month}</b><span>🏆 {x.manager?.manager}: {x.manager?.points} pkt</span><span>🤡 {x.fraud?.manager}: {x.fraud?.points} pkt</span></div>)}
     </Card>
   </section>}
   {data&&tab==="muzeum"&&<section className="megaGrid">
     <Card title="🏛️ Muzeum kompromitacji">
       <div className="awardGallery">{data.museum.map((x,i)=><div className="awardBig" key={i}><span>{x.icon}</span><div><b>{x.name}</b><strong>{x.manager}</strong><small>{x.team} • {x.value}</small></div></div>)}</div>
     </Card>
   </section>}
   {data&&tab==="studio"&&<PostMatchStudio data={data}/>}
   {data&&tab==="rywalizacja"&&<section className="megaGrid">
     <Card title="🥊 Rywalizacje head-to-head">
       <div className="rivalryCards">
         {data.rivalryProfiles.map(x=><details className="rivalryCard" key={x.entry}>
           <summary>
             <div><span>⚔️</span><div><b>{x.manager}</b><small>{x.team}</small></div></div>
             <strong>rozwiń</strong>
           </summary>
           <div className="rivalryBody">
             {x.matches.map((m,i)=><div className="rivalryLine" key={i}>
               <span>vs <b>{m.opponent}</b></span>
               <strong className={m.wins>m.losses?"positive":m.wins<m.losses?"negative":""}>{m.wins}–{m.losses}</strong>
               <small>remisy: {m.draws}</small>
             </div>)}
           </div>
         </details>)}
       </div>
     </Card>
     <Card title="⭐ Oceny redakcji">
       {[...data.grades].sort((a,b)=>b.editorial-a.editorial).map(x=><div className="grade" key={x.entry}><b>{x.icon} {x.manager}: {x.editorial}/10 — {x.label}</b><p>{x.comment}</p></div>)}
     </Card>
   </section>}
   {data&&tab==="gala"&&<section className="megaGrid">
     <Card title={data.gw>=38&&data.gwFinished?"🏁 FPLowa Awards — GALA FINAŁOWA":"🏆 FPLowa Awards — stan na dziś"}>
       <div className="awardGallery">{data.seasonAwards.map((x,i)=><div className="awardBig" key={i}><span>{x.icon}</span><div><b>{x.name}</b><strong>{x.manager}</strong><small>{x.team} • {x.value}</small></div></div>)}</div>
     </Card>
     <Card title="🎙️ Konferencja prasowa">
       {data.grades.map((x,i)=><blockquote key={x.entry}><div className="pressSpeaker"><span>🎙️</span><div><b>{x.manager}</b><small>{x.team}</small></div></div>{pressQuote(x,data.gw,i,data.grades)}<small>{pressReaction(x,data.gw,i,data.grades)}</small></blockquote>)}
     </Card>
   </section>}
 </main>
 </>
}
function PostMatchStudio({data}){
 const people=[...(data?.grades||[])].sort((a,b)=>Number(b.gwPoints||0)-Number(a.gwPoints||0));
 if(!people.length){
   return <section className="studioWrap"><div className="megaCard"><h2>📺 Pomeczowe studio</h2><p>Brak danych do przygotowania studia dla tej kolejki.</p></div></section>;
 }
 const hero=people[0], victim=people.at(-1), middle=people[Math.floor(people.length/2)];
 const seed=confHash(`studio|${data.gw}|${hero?.manager||"none"}|${victim?.manager||"none"}`);
 const openings=[
   `GW ${data.gw} zamknięta. Na jednym końcu ${hero?.manager} z ${hero?.gwPoints} pkt, na drugim ${victim?.manager} z ${victim?.gwPoints}. Czy możemy już użyć słowa kompromitacja?`,
   `Witamy po GW ${data.gw}. ${hero?.team} urządziło sobie bankiet, a ${victim?.team} najwyraźniej przyszło tylko pozmywać naczynia. Od czego zaczynamy?`,
   `Tabela po GW ${data.gw} wygląda tak, jakby połowa ligi grała w FPL, a druga połowa prowadziła eksperyment społeczny. ${hero?.manager} na górze tej kolejki, ${victim?.manager} pod lupą.`
 ];
 const heroLines=[
   `${hero?.manager} może dziś kozaczyć. ${hero?.gwPoints} punktów nie wzięło się z modlitwy, chociaż w FPL odrobina boskiej interwencji nigdy nie szkodzi.`,
   `${hero?.team} zrobiło robotę. Teraz najważniejsze, żeby ${hero?.manager} nie uznał tego za dowód, że każda jego przyszła decyzja jest genialna.`,
   `Dzisiaj chwalimy ${hero?.manager}. Jutro może sprzedać najlepszego zawodnika za differential z trzema minutami w sezonie, więc zachowajmy umiar.`
 ];
 const victimLines=[
   `${victim?.manager} ma ${victim?.gwPoints} pkt i kilka godzin na wymyślenie, jak nazwać to „długoterminową strategią”. Ja proponuję: wpierdol.`,
   `${victim?.team} wyglądało tak źle, że nawet czerwone strzałki powinny dostać dodatek za pracę w trudnych warunkach.`,
   `Nie wiem, co ${victim?.manager} widział przed deadlinem, ale po deadlinie wszyscy widzimy jedno: materiał szkoleniowy pod tytułem „czego, kurwa, nie robić”.`
 ];
 const middleLines=[
   `${middle?.manager} z ${middle?.team} przeżył kolejkę bez wielkiej chwały i bez publicznej egzekucji. W tej lidze to prawie sukces.`,
   `O ${middle?.team} mówi się mało, czyli ${middle?.manager} osiągnął rzadki luksus: nie dał redakcji wystarczająco dużo amunicji.`,
   `${middle?.manager} siedzi pośrodku chaosu. Ani pomnik, ani list gończy. Bardzo nie-FPLowe zachowanie.`
 ];
 const closings=[
   `Podsumowując GW ${data.gw}: zwycięzcy niech nie odlatują, przegrani niech nie robią -20 z zemsty, a reszta niech pamięta, że deadline zawsze znajdzie nowy sposób, żeby zrobić z człowieka idiotę.`,
   `To wszystko po GW ${data.gw}. Za tydzień wrócimy, gdy ci sami ludzie z pełnym przekonaniem podejmą zupełnie nowe, spektakularnie złe decyzje.`,
   `Kończymy studio GW ${data.gw}. FPL po raz kolejny udowodniło, że najdroższym zasobem nie jest budżet 100 milionów, tylko zdolność do niedotykania transferów po pijaku.`
 ];
 const dialogues=[
  {q:openings[seed%openings.length],a:heroLines[(seed>>3)%heroLines.length],b:victimLines[(seed>>5)%victimLines.length]},
  {q:`A co z menedżerami, którzy po GW ${data.gw} są gdzieś pomiędzy paradą zwycięstwa a śmietnikiem historii?`,a:middleLines[(seed>>7)%middleLines.length],b:`I właśnie dlatego ${middle?.manager} może dziś spać spokojniej niż ${victim?.manager}. Nie dobrze. Po prostu spokojniej.`},
  {q:`Ostatnie słowo przed następnym deadlinem?`,a:closings[(seed>>9)%closings.length],b:`Redakcja przypomina: jeśli transfer wydaje się genialny o 01:47 w nocy, prawdopodobnie należy odłożyć telefon.`}
 ];
 return <section className="studioWrap">
   <div className="studioTitle"><span>📺</span><div><span className="paperKicker">FPLOWA TV</span><h2>Pomeczowe studio GW {data.gw}</h2></div></div>
   {dialogues.map((d,i)=><article className="studioSegment" key={`${data.gw}-${i}`}><h3>{d.q}</h3><div className="expertLine"><b>🎙️ Ekspert A:</b><p>{d.a}</p></div><div className="expertLine"><b>🗣️ Ekspert B:</b><p>{d.b}</p></div></article>)}
 </section>
}

function Card({title,children}){return <section className="megaCard"><h2>{title}</h2>{children}</section>}
function Standings({data,onProfile}){return <section className="fplStandings"><div className="sectionHead"><div><span className="sectionLabel">LIGA 286732</span><h2>{data.league.name}</h2></div><span>GW {data.gw}</span></div><div className="fplTable"><div className="fplTr fplTh"><span>#</span><span>Drużyna</span><span>GW</span><span>Suma</span><span>Zmiana</span></div>{data.standings.map(x=><button className="fplTr fplRowBtn" key={x.entry} onClick={()=>onProfile(x.entry)}><strong>{x.rank}</strong><div><strong>{x.team}</strong><small>{x.manager}</small></div><strong>{x.gwPoints}</strong><span>{x.overall}</span><span>{x.lastRank>x.rank?`▲ ${x.lastRank-x.rank}`:x.lastRank<x.rank?`▼ ${x.rank-x.lastRank}`:"—"}</span></button>)}</div></section>}
function Profile({p,close}){
 return <div className="profileModal">
   <button onClick={close}>✕</button>
   <div className="profileHeader">
     <div className="profileHeroIcon">{p.icon}</div>
     <div><span className="newsTag">{p.label}</span><h2>{p.manager}</h2><p>{p.team}</p></div>
   </div>

   <div className="profileStats">
     <b>🏁 Overall #{p.rank}</b>
     <b>🌡️ Forma {p.form}</b>
     <b>⭐ Ocena {p.editorial}/10</b>
     <b>📊 Średnia {p.avg}</b>
     <b>⚡ 3 GW {p.avg3}</b>
     <b>🪑 Ławka {p.benchSeason}</b>
     <b>💸 Hity -{p.hitSeason}</b>
     <b>⚽ Gole {p.seasonGoals ?? 0}</b>
     <b>🥅 Stracone {p.seasonConceded ?? 0}</b>
   </div>

   <div className="profileStory">
     <section>
       <span>🧠 PORTRET MENEDŻERA</span>
       <p>{p.profileLead}</p>
     </section>
     <section>
       <span>📈 CO MÓWI FORMA</span>
       <p>{p.profileForm}</p>
     </section>
     <section className="profileVerdict">
       <span>🗞️ WERDYKT REDAKCJI</span>
       <p>{p.profileVerdict}</p>
     </section>
   </div>

   {p.achievements?.length>0&&<div className="trophyCabinet"><span>🏆 GABLOTA</span><div>{p.achievements.map((a,i)=><div className="trophy" key={i}><b>{a.icon} {a.name}</b><small>{a.value}</small></div>)}</div></div>}

   <div className="profileExtremes">
     {p.bestGW&&<div><span>🚀 Najlepsza GW</span><b>{p.bestGW.points} pkt • GW{p.bestGW.gw}</b></div>}
     {p.worstGW&&<div><span>🪦 Najgorsza GW</span><b>{p.worstGW.points} pkt • GW{p.worstGW.gw}</b></div>}
   </div>
 </div>
}