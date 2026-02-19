import { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Printer, Upload, Layout, ChevronDown, RefreshCcw, X } from 'lucide-react';
import { fetchHijriCalendarByCity, type PrayerData } from './logic/api';
import { guessLocation, guessCityCountry } from './logic/geo';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import './App.css';

function App() {
  const [showEditor, setShowEditor] = useState(false);
  const [location, setLocation] = useState<{ city: string; country: string }>({ city: '', country: '' });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReadonlyArray<PrayerData>>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    handleAutoDetect();
  }, []);

  const handleAutoDetect = async () => {
    setLoading(true);
    setError(null);
    try {
      const loc = await guessLocation();
      if (loc) {
        setLocation({ city: loc.city, country: loc.country });
        fetchVaktija(loc.city, loc.country);
      }
    } catch (err) {
      setError('Neuspješna automatska detekcija lokacije.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    setError(null);
    try {
      const res = await guessCityCountry(searchQuery);
      if (res) {
        setLocation({ city: res.city, country: res.country });
        fetchVaktija(res.city, res.country);
      } else {
        setError('Grad nije pronađen.');
      }
    } catch (err) {
      setError('Greška pri pretrazi.');
    } finally {
      setLoading(false);
    }
  };

  const fetchVaktija = async (city: string, country: string) => {
    setLoading(true);
    try {
      const [ramadanData, shawwalData] = await Promise.all([
        fetchHijriCalendarByCity({ city, country, year: 1447, month: 9 }),
        fetchHijriCalendarByCity({ city, country, year: 1447, month: 10 }),
      ]);
      // API's Hijri calculation starts 1 day early for Ramadan 1447
      // Ramadan 1 is Feb 19, 2026 — skip the first day (Feb 18)
      // and add 1 day from Shawwal to complete 30 days
      setData([...ramadanData.slice(1), shawwalData[0]]);
    } catch (err) {
      setError('Greška pri dohvaćanju vaktije.');
    } finally {
      setLoading(false);
    }
  };

  const todayData = data.find(d => {
    const today = new Date().toLocaleDateString();
    const dayDate = new Date(parseInt(d.date.timestamp) * (d.date.timestamp.length > 10 ? 1 : 1000)).toLocaleDateString();
    return today === dayDate;
  }) || data[0];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const scrollToTable = () => {
    tableRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-main selection:bg-primary/30">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center no-print">
        <div className="max-w-3xl w-full">
          <header className="mb-12">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
              Ramazanska Vaktija
            </h1>
          </header>

          {loading ? (
            <div className="my-12 flex flex-col items-center gap-4 animate-pulse">
              <RefreshCcw className="w-10 h-10 text-primary animate-spin" />
              <p className="text-primary font-semibold">Pripremam vaktiju...</p>
            </div>
          ) : location.city && todayData ? (
            <Card className="max-w-xl mx-auto text-left animate-fade-in mb-12">
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2 text-primary">
                  <MapPin size={22} /> Danas u {location.city}
                </CardTitle>
                <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  {data.indexOf(todayData) + 1}. Ramadan 1447
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 bg-muted rounded-xl border text-center">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Imsak / Zora</span>
                    <span className="text-2xl font-bold text-foreground">{todayData.timings.Fajr.split(' ')[0]}</span>
                  </div>
                  <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 text-center ring-1 ring-amber-500/20">
                    <span className="block text-[10px] uppercase font-bold text-amber-600 dark:text-amber-500 mb-1">Iftar / Akšam</span>
                    <span className="text-2xl font-bold text-amber-600 dark:text-amber-500">{todayData.timings.Maghrib.split(' ')[0]}</span>
                  </div>
                  <div className="p-4 bg-muted rounded-xl border text-center">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Jacija</span>
                    <span className="text-2xl font-bold text-foreground">{todayData.timings.Isha.split(' ')[0]}</span>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t text-center text-muted-foreground font-medium text-sm italic">
                  {new Date().toLocaleDateString('bs-BA', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="h-14 px-8 rounded-2xl shadow-lg" onClick={scrollToTable}>
              Pogledaj ceo mesec <ChevronDown className="ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 rounded-2xl" onClick={() => setShowEditor(!showEditor)}>
              <Layout className="mr-2 h-5 w-5" /> {showEditor ? 'Zatvori podešavanja' : 'Personalizuj vaktiju'}
            </Button>
          </div>
        </div>
      </section>

      {/* Configuration Section */}
      {showEditor && (
        <section className="py-12 px-6 no-print bg-muted/30 border-t animate-slide-down">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground uppercase tracking-wide italic font-black">
                  <Search size={18} /> PROMIJENI LOKACIJU
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Npr. Sarajevo, Sandžak, Beč..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="h-11"
                  />
                  <Button onClick={handleSearch} disabled={loading} className="h-11 px-6">
                    Generiši
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={handleAutoDetect} disabled={loading} className="text-muted-foreground hover:text-foreground">
                  <MapPin size={14} className="mr-2" /> Moja lokacija
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground uppercase tracking-wide italic font-black">
                  <Upload size={18} /> DODAJ LOGO / SLIKU
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative border-2 border-dashed rounded-xl h-28 flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors group">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" title="Klikni za dodavanje slike" />
                  {logo ? (
                    <div className="w-full h-full bg-white flex items-center justify-center p-2">
                      <img src={logo} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                      <Button variant="destructive" size="icon" className="absolute top-2 right-2 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={() => setLogo(null)}>
                        <X size={12} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground gap-2">
                      <Upload size={24} />
                      <span className="text-xs font-semibold">Kliknite ili povucite fajl</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {error && (
        <div className="mx-6 my-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-center no-print">
          {error}
        </div>
      )}

      {/* Main Vaktija Area */}
      {data.length > 0 && (
        <div ref={tableRef} className="vaktija-container flex-1">
          <div className="mx-auto max-w-4xl m-4 md:m-8 md:mx-auto vaktija-printable-area bg-card shadow-2xl rounded-3xl overflow-hidden border border-border/50 print:bg-white print:shadow-none print:border-none print:m-0 print:rounded-none print:max-w-none">
            {/* HEADER: Image background + text overlay */}
            <header className={cn(
              "vaktija-header overflow-hidden relative",
              logo ? "h-[220px] md:h-[300px]" : "h-[100px] md:h-[140px]"
            )}>
              {/* Background image or dark placeholder */}
              <div className="vaktija-logo absolute inset-0 z-0">
                {logo ? (
                  <img src={logo} alt="Vaktija Header" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-emerald-950" />
                )}
              </div>
              {/* Text overlay - absolutely positioned ON the image */}
              <div className="vaktija-brand absolute inset-0 z-10 flex flex-col justify-end p-4 md:p-8 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                <h2 className="text-xl md:text-4xl font-black italic tracking-tighter text-white drop-shadow-lg">RAMAZANSKA VAKTIJA 1447</h2>
                <div className="flex items-center gap-1.5 text-amber-400 font-bold tracking-widest text-[10px] md:text-sm uppercase mt-1 drop-shadow-sm">
                  <MapPin size={14} /> {location.city}, {location.country}
                </div>
              </div>
            </header>

            {/* TABLE: Its own section */}
            <div className="vaktija-table-wrapper overflow-x-auto relative">
              {/* Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 print:opacity-[0.03]">
                <img src="vahalogo.webp" alt="" className="w-[70%] md:w-[80%] opacity-[0.04] dark:opacity-[0.06]" draggable={false} />
              </div>
              <Table className="w-full relative z-10">
                <TableHeader>
                  <TableRow className="bg-emerald-900 hover:bg-emerald-900 border-none">
                    <TableHead className="font-black text-white text-center italic text-[10px] md:text-sm px-1 md:px-4 h-8 md:h-10">RAM.</TableHead>
                    <TableHead className="font-black text-white text-center italic text-[10px] md:text-sm px-1 md:px-4 h-8 md:h-10">DAN</TableHead>
                    <TableHead className="font-black text-white text-center italic text-[10px] md:text-sm px-1 md:px-4 h-8 md:h-10">DATUM</TableHead>
                    <TableHead className="font-black text-white text-center italic text-[10px] md:text-sm px-1 md:px-4 h-8 md:h-10">ZORA</TableHead>
                    <TableHead className="font-black text-white text-center italic hidden md:table-cell print:table-cell h-8 md:h-10">SUNCE</TableHead>
                    <TableHead className="font-black text-white text-center italic hidden md:table-cell print:table-cell h-8 md:h-10">PODNE</TableHead>
                    <TableHead className="font-black text-white text-center italic hidden md:table-cell print:table-cell h-8 md:h-10">IKINDIJA</TableHead>
                    <TableHead className="font-black text-amber-300 text-center italic text-[10px] md:text-sm px-1 md:px-4 h-8 md:h-10">IFTAR</TableHead>
                    <TableHead className="font-black text-white text-center italic hidden md:table-cell print:table-cell h-8 md:h-10">JACIJA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((day, index) => {
                    const translations: Record<string, string> = {
                      'Monday': 'Pon.', 'Tuesday': 'Uto.', 'Wednesday': 'Sri.',
                      'Thursday': 'Čet.', 'Friday': 'Pet.', 'Saturday': 'Sub.', 'Sunday': 'Ned.',
                      'February': 'Feb.', 'March': 'Mar.'
                    };
                    const dayName = translations[day.date.gregorian.weekday.en] || day.date.gregorian.weekday.en;
                    const monthName = translations[day.date.gregorian.month.en] || day.date.gregorian.month.en;
                    const isToday = new Date().toLocaleDateString() === new Date(parseInt(day.date.timestamp) * (day.date.timestamp.length > 10 ? 1 : 1000)).toLocaleDateString();

                    return (
                      <TableRow key={index} className={cn(
                        "hover:bg-muted/50 transition-colors border-border/50 h-7 md:h-auto",
                        isToday && "bg-primary/10 font-bold"
                      )}>
                        <TableCell className="text-center px-0.5 md:px-4 py-0.5 md:py-1">
                          <span className="inline-flex items-center justify-center w-5 h-5 md:w-7 md:h-7 bg-emerald-700 text-white print:bg-transparent print:text-black rounded-full text-[9px] md:text-[11px] font-black italic">
                            {index + 1}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-medium text-muted-foreground print:text-black text-[10px] md:text-sm px-0.5 md:px-4 py-0.5">{dayName}</TableCell>
                        <TableCell className="text-center font-medium text-muted-foreground print:text-black text-[10px] md:text-sm px-0.5 md:px-4 py-0.5">{day.date.gregorian.day}. {monthName}</TableCell>
                        <TableCell className="text-center text-foreground print:text-black font-bold text-[11px] md:text-sm px-0.5 md:px-4 py-0.5">{day.timings.Fajr.split(' ')[0]}</TableCell>
                        <TableCell className="text-center text-muted-foreground print:text-black hidden md:table-cell print:table-cell py-0.5">{day.timings.Sunrise.split(' ')[0]}</TableCell>
                        <TableCell className="text-center text-muted-foreground print:text-black hidden md:table-cell print:table-cell py-0.5">{day.timings.Dhuhr.split(' ')[0]}</TableCell>
                        <TableCell className="text-center text-muted-foreground print:text-black hidden md:table-cell print:table-cell py-0.5">{day.timings.Asr.split(' ')[0]}</TableCell>
                        <TableCell className="text-center bg-amber-500/5 px-0.5 md:px-4 py-0.5">
                          <span className="text-amber-600 dark:text-amber-400 print:text-black font-black text-[11px] md:text-base">
                            {day.timings.Maghrib.split(' ')[0]}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-foreground print:text-black hidden md:table-cell print:table-cell py-0.5">{day.timings.Isha.split(' ')[0]}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* FOOTER: Simple one-line */}
            <footer className="flex flex-row items-center justify-between px-4 md:px-6 py-3 print:py-1 print:px-2 border-t border-border/30">
              <div className="text-emerald-700 dark:text-emerald-400 font-black italic text-[10px] md:text-sm tracking-tight uppercase">Ramazan Šerif Mubarek Olsun!</div>
              <div className="text-[7px] md:text-[9px] font-medium text-muted-foreground tracking-widest uppercase">Generisano putem vaha.net web sajta</div>
            </footer>
          </div>
        </div>
      )}

      {data.length > 0 && (
        <div className="flex justify-center pb-20 no-print">
          <Button size="lg" className="h-14 px-10 rounded-2xl shadow-xl text-lg font-bold italic" onClick={handlePrint}>
            <Printer className="mr-3" /> SAČUVAJ KAO PDF / ŠTAMPAJ
          </Button>
        </div>
      )}
    </div>
  );
}

export default App;
