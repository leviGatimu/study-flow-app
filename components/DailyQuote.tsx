'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const VERSES = [
  { text: "Whatever your hand finds to do, do it with all your might, for in the realm of the dead, where you are going, there is neither working nor planning nor knowledge nor wisdom.", ref: "Ecclesiastes 9:10" },
  { text: "Commit to the Lord whatever you do, and he will establish your plans.", ref: "Proverbs 16:3" },
  { text: "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.", ref: "Colossians 3:23" },
  { text: "Let the wise hear and increase in learning, and the one who understands obtain guidance.", ref: "Proverbs 1:5" },
  { text: "For the Lord gives wisdom; from his mouth come knowledge and understanding.", ref: "Proverbs 2:6" },
  { text: "Do you see a man skillful in his work? He will stand before kings; he will not stand before obscure men.", ref: "Proverbs 22:29" },
  { text: "The plans of the diligent lead surely to abundance, but everyone who is hasty comes only to poverty.", ref: "Proverbs 21:5" },
  { text: "I can do all things through Christ who strengthens me.", ref: "Philippians 4:13" },
  { text: "For I know the plans I have for you,” declares the Lord, “plans to prosper you and not to harm you, plans to give you hope and a future.", ref: "Jeremiah 29:11" },
  { text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.", ref: "Joshua 1:9" },
  { text: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.", ref: "Proverbs 3:5-6" },
  { text: "The Lord is my shepherd, I shall not be in want.", ref: "Psalm 23:1" },
  { text: "Do not conform to the pattern of this world, but be transformed by the renewing of your mind.", ref: "Romans 12:2" },
  { text: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.", ref: "Isaiah 40:31" },
  { text: "Therefore do not worry about tomorrow, for tomorrow will worry about itself. Each day has enough trouble of its own.", ref: "Matthew 6:34" },
  { text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.", ref: "Romans 8:28" },
  { text: "Give thanks in all circumstances; for this is God’s will for you in Christ Jesus.", ref: "1 Thessalonians 5:18" },
  { text: "Ask and it will be given to you; seek and you will find; knock and the door will be opened to you.", ref: "Matthew 7:7" },
  { text: "For God has not given us a spirit of fear, but of power and of love and of a sound mind.", ref: "2 Timothy 1:7" },
  { text: "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.", ref: "Galatians 6:9" },
  { text: "A peaceful heart leads to a healthy body; jealousy is like cancer in the bones.", ref: "Proverbs 14:30" },
  { text: "I have told you these things, so that in me you may have peace. In this world you will have trouble. But take heart! I have overcome the world.", ref: "John 16:33" },
  { text: "May the God of hope fill you with all joy and peace as you trust in him, so that you may overflow with hope by the power of the Holy Spirit.", ref: "Romans 15:13" },
  { text: "He gives strength to the weary and increases the power of the weak.", ref: "Isaiah 40:29" },
  { text: "Come to me, all you who are weary and burdened, and I will give you rest.", ref: "Matthew 11:28" },
  { text: "This is the day the Lord has made; let us rejoice and be glad in it.", ref: "Psalm 118:24" },
  { text: "Cast all your anxiety on him because he cares for you.", ref: "1 Peter 5:7" },
  { text: "The Lord will fight for you; you need only to be still.", ref: "Exodus 14:14" },
  { text: "So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.", ref: "Isaiah 41:10" },
  { text: "Above all else, guard your heart, for everything you do flows from it.", ref: "Proverbs 4:23" },
  { text: "The heart of the discerning acquires knowledge, for the ears of the wise seek it out.", ref: "Proverbs 18:15" },
  { text: "Wisdom’s instruction is to fear the Lord, and humility comes before honor.", ref: "Proverbs 15:33" },
  { text: "The fear of the Lord is the beginning of knowledge, but fools despise wisdom and instruction.", ref: "Proverbs 1:7" },
  { text: "Call to me and I will answer you and tell you great and unsearchable things you do not know.", ref: "Jeremiah 33:3" },
  { text: "If any of you lacks wisdom, you should ask God, who gives generously to all without finding fault, and it will be given to you.", ref: "James 1:5" },
  { text: "Blessed is the one who finds wisdom, the one who gains understanding.", ref: "Proverbs 3:13" },
  { text: "Plans fail for lack of counsel, but with many advisers they succeed.", ref: "Proverbs 15:22" },
  { text: "Wait for the Lord; be strong and take heart and wait for the Lord.", ref: "Psalm 27:14" },
  { text: "The Lord is my light and my salvation—whom shall I fear? The Lord is the stronghold of my life—of whom shall I be afraid?", ref: "Psalm 27:1" },
  { text: "But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control. Against such things there is no law.", ref: "Galatians 5:22-23" },
  { text: "Your word is a lamp for my feet, a light on my path.", ref: "Psalm 119:105" },
  { text: "But you, take courage! Do not let your hands be weak, for your work shall be rewarded.", ref: "2 Chronicles 15:7" },
  { text: "Great is our Lord and mighty in power; his understanding has no limit.", ref: "Psalm 147:5" },
  { text: "So then, my beloved brothers, let every man be swift to hear, slow to speak, slow to wrath.", ref: "James 1:19" },
  { text: "Whatever is true, whatever is noble, whatever is right, whatever is pure, whatever is lovely, whatever is admirable—if anything is excellent or praiseworthy—think about such things.", ref: "Philippians 4:8" },
  { text: "The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you; the Lord turn his face toward you and give you peace.", ref: "Numbers 6:24-26" },
  { text: "Strength and dignity are her clothing, and she laughs at the time to come.", ref: "Proverbs 31:25" },
  { text: "The name of the Lord is a strong tower; the righteous man runs into it and is safe.", ref: "Proverbs 18:10" },
  { text: "For we walk by faith, not by sight.", ref: "2 Corinthians 5:7" },
  { text: "The Lord will guide you always; he will satisfy your needs in a sun-scorched land and will strengthen your frame.", ref: "Isaiah 58:11" }
];

export function DailyQuote() {
  const [verse, setVerse] = useState(VERSES[0]);
  const [mounted, setMounted] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const updateVerse = () => {
      const hoursSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60));
      const index = hoursSinceEpoch % VERSES.length;
      const currentVerse = VERSES[index];
      setVerse(currentVerse);

      // Save to shown history in localStorage
      if (typeof window !== 'undefined') {
        try {
          const savedHistory = localStorage.getItem('study-flow-bible-history');
          let historyList = savedHistory ? JSON.parse(savedHistory) : [];
          if (!historyList.some((h: any) => h.ref === currentVerse.ref)) {
            historyList = [
              { text: currentVerse.text, ref: currentVerse.ref, shownAt: new Date().toISOString() },
              ...historyList
            ];
            localStorage.setItem('study-flow-bible-history', JSON.stringify(historyList.slice(0, 50)));
          }
        } catch (e) {
          console.error("Failed to update bible history", e);
        }
      }
    };

    updateVerse();
    
    const interval = setInterval(updateVerse, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      try {
        const savedBookmarked = localStorage.getItem('study-flow-bible-bookmarked');
        const bookmarkedList = savedBookmarked ? JSON.parse(savedBookmarked) : [];
        setIsBookmarked(bookmarkedList.some((b: any) => b.ref === verse.ref));
      } catch (e) {
        // Fallback
      }
    }
  }, [verse, mounted]);

  const toggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const savedBookmarked = localStorage.getItem('study-flow-bible-bookmarked');
      let bookmarkedList = savedBookmarked ? JSON.parse(savedBookmarked) : [];
      
      let nextState = false;
      if (isBookmarked) {
        bookmarkedList = bookmarkedList.filter((b: any) => b.ref !== verse.ref);
        nextState = false;
      } else {
        bookmarkedList.push({ text: verse.text, ref: verse.ref, savedAt: new Date().toISOString() });
        nextState = true;
      }
      localStorage.setItem('study-flow-bible-bookmarked', JSON.stringify(bookmarkedList));
      setIsBookmarked(nextState);
    } catch (err) {
      console.error(err);
    }
  };

  if (!mounted) return null;

  return (
    <Link href="/bible" className="block mt-6">
      <div className="bg-card border border-border/60 border-l-4 border-l-primary p-6 sm:p-8 rounded-3xl shadow-sm relative overflow-hidden animate-in fade-in duration-500 hover:-translate-y-0.5 hover:shadow-md transition-all group">
        <div className="absolute left-0 bottom-0 w-full h-1/2 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
        
        {/* Bookmark Button */}
        <div className="absolute top-4 right-4 z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleBookmark}
            className={cn(
              "h-9 w-9 rounded-xl transition-all duration-300 hover:bg-muted active:scale-90",
              isBookmarked ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"
            )}
          >
            <Bookmark className={cn("w-5 h-5", isBookmarked && "fill-current")} />
          </Button>
        </div>

        <blockquote className="italic text-muted-foreground text-lg leading-relaxed relative z-10 pr-10">
          &quot;{verse.text}&quot;
          <footer className="mt-4 text-sm font-bold text-foreground/80 flex items-center gap-2">
            <span className="w-4 h-[2px] bg-primary rounded-full"></span> {verse.ref}
          </footer>
        </blockquote>
      </div>
    </Link>
  );
}

