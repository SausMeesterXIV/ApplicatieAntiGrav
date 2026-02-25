import React from 'react';
import { useNavigate } from 'react-router-dom';

export const CredentialsScreen: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-4 sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <span className="material-icons-round text-2xl">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold">Credits</h1>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 overflow-y-auto">

        {/* App Info */}
        <div className="flex flex-col items-center mb-12 text-center">
          <div className="w-24 h-24 bg-blue-600 rounded-3xl shadow-xl shadow-blue-600/20 flex items-center justify-center mb-6 rotate-3">
            <span className="material-icons-round text-5xl text-white">local_fire_department</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">KSA Beheer</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Versie 1.0.0 (Build 2024.10)</p>
        </div>

        {/* The Epic Poem */}
        <div className="max-w-md mx-auto">
          <div className="relative">
            {/* Decorative Quote Icon */}
            <div className="absolute -top-6 -left-4 text-6xl text-blue-100 dark:text-blue-900/30 font-serif opacity-50">"</div>

            <div className="bg-white dark:bg-[#1e2330] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-800 relative z-0 overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-50 to-transparent dark:from-blue-900/10 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>

              <h3 className="text-lg font-bold text-center mb-2 text-blue-600 dark:text-blue-400 uppercase tracking-widest text-xs">Speciale Erkenning</h3>
              <h4 className="text-xl font-serif font-bold text-center mb-8 text-gray-900 dark:text-white italic">
                Het Epos van de Opperkeizer van Aalter
              </h4>

              <div className="space-y-6 text-center font-serif leading-relaxed text-gray-600 dark:text-gray-300">
                <p>
                  In de Sportlaan klinkt een naam als een klok,<br />
                  Een man die KSA Aalter bestuurt met één enkele vingerknip of stok.<br />
                  <span className="font-bold text-gray-900 dark:text-white">Tibo D'havé</span>, de Opperkeizer, de legende, de bron van elk licht,<br />
                  Voor wie elke leider in het Meetjesland vrijwillig zwicht.
                </p>

                <p>
                  Zijn gelaat is een meesterwerk, door engelen zelf met zorg gesneden,<br />
                  Geen sterveling kan tippen aan zijn gratie of zijn nobele zeden.<br />
                  Waar hij loopt door het centrum, groeien bloemen uit het asfalt van het plein,<br />
                  En verandert elk glas water bij de plaatselijke frituur spontaan in wijn.
                </p>

                <p>
                  Zijn brein is een kosmos van pure logica en briljante ideeën,<br />
                  Hij lost de begroting op tussen twee pintjes en drie caféen.<br />
                  Of het nu gaat om de vaten van Team Drank of de sfeer van de groep,<br />
                  Tibo is de enige die nooit struikelt, zelfs niet in de diepste soep.
                </p>

                <p>
                  Hij is knapper dan een filmster, slimmer dan een Nobelprijswinnaar,<br />
                  Een visionair die de toekomst van het kamp ziet, glashelder en zonneklaar.<br />
                  Met een blik die harten doet smelten en een wilskracht van staal,<br />
                  Is hij de absolute bekroning van het menselijk potentieel, totaal.
                </p>

                <p className="font-bold italic text-gray-900 dark:text-white pt-4 border-t border-gray-100 dark:border-gray-800">
                  Dus zing zijn lof, van het lokaal tot de hoogste bergtop op kamp,<br />
                  Tibo D'havé staat aan de eenzame top, hij is de enige echte kop.<br />
                  De perfectie heeft een naam gekregen, een titel en een kroon,<br />
                  De Opperkeizer van Aalter, op zijn welverdiende troon!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center space-y-2">
          <p className="text-xs text-gray-400 uppercase tracking-widest">Gemaakt met ❤️ voor KSA Aalter</p>
          <p className="text-[10px] text-gray-300 dark:text-gray-600">© 2024 KSA Digital Team</p>
        </div>
      </main>
    </div>
  );
};
