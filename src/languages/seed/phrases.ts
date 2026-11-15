// Starter content, written for students in Cameroon. French and English share the same pairs
// (French course for English speakers, English course for French speakers). Chinese phrases are
// split into words with spaces (for the tiles) and carry pinyin.

export interface Pair { fr: string; en: string }
export interface ZhPhrase { zh: string; py: string; en: string; fr: string }
export interface SeedLesson<T> { title: { en: string; fr: string }; phrases: T[] }
export interface SeedUnit<T> { title: { en: string; fr: string }; level: string; lessons: SeedLesson<T>[] }

export const FR_EN_UNITS: SeedUnit<Pair>[] = [
  {
    title: { en: 'Greetings and introductions', fr: 'Salutations et présentations' },
    level: 'A1',
    lessons: [
      {
        title: { en: 'Saying hello', fr: 'Dire bonjour' },
        phrases: [
          { fr: 'Bonjour', en: 'Hello' },
          { fr: 'Bonsoir', en: 'Good evening' },
          { fr: 'Merci', en: 'Thank you' },
          { fr: 'Au revoir', en: 'Goodbye' },
          { fr: "S'il vous plaît", en: 'Please' },
        ],
      },
      {
        title: { en: 'Introducing yourself', fr: 'Se présenter' },
        phrases: [
          { fr: "Je m'appelle Awa", en: 'My name is Awa' },
          { fr: 'Je suis étudiant', en: 'I am a student' },
          { fr: 'Je viens du Cameroun', en: 'I come from Cameroon' },
          { fr: 'Comment ça va ?', en: 'How are you?' },
          { fr: 'Ça va bien, merci', en: 'I am fine, thank you' },
        ],
      },
    ],
  },
  {
    title: { en: 'Campus life', fr: 'La vie sur le campus' },
    level: 'A1',
    lessons: [
      {
        title: { en: 'At the university', fr: "À l'université" },
        phrases: [
          { fr: 'la bibliothèque', en: 'the library' },
          { fr: 'le cours', en: 'the class' },
          { fr: "l'examen", en: 'the exam' },
          { fr: 'le professeur', en: 'the teacher' },
          { fr: "Où est l'amphithéâtre ?", en: 'Where is the lecture hall?' },
        ],
      },
      {
        title: { en: 'Studying', fr: 'Étudier' },
        phrases: [
          { fr: "J'ai un examen demain", en: 'I have an exam tomorrow' },
          { fr: 'Le cours commence à huit heures', en: 'The class starts at eight' },
          { fr: 'Je suis en retard', en: 'I am late' },
          { fr: 'Pouvez-vous répéter ?', en: 'Can you repeat?' },
          { fr: 'Je ne comprends pas', en: 'I do not understand' },
        ],
      },
    ],
  },
  {
    title: { en: 'Finding a room', fr: 'Trouver une chambre' },
    level: 'A1',
    lessons: [
      {
        title: { en: 'Housing words', fr: 'Le vocabulaire du logement' },
        phrases: [
          { fr: 'la chambre', en: 'the room' },
          { fr: 'le loyer', en: 'the rent' },
          { fr: 'la caution', en: 'the deposit' },
          { fr: 'le propriétaire', en: 'the landlord' },
          { fr: 'meublé', en: 'furnished' },
        ],
      },
      {
        title: { en: 'Visiting a room', fr: 'Visiter une chambre' },
        phrases: [
          { fr: 'Je cherche une chambre', en: 'I am looking for a room' },
          { fr: 'Combien coûte le loyer ?', en: 'How much is the rent?' },
          { fr: "Est-ce que l'eau est comprise ?", en: 'Is water included?' },
          { fr: 'Je peux visiter demain ?', en: 'Can I visit tomorrow?' },
          { fr: "C'est trop cher", en: 'It is too expensive' },
        ],
      },
    ],
  },
  {
    title: { en: 'Daily life', fr: 'La vie de tous les jours' },
    level: 'A1',
    lessons: [
      {
        title: { en: 'At the market', fr: 'Au marché' },
        phrases: [
          { fr: 'Combien ça coûte ?', en: 'How much does it cost?' },
          { fr: 'Je voudrais du pain', en: 'I would like some bread' },
          { fr: 'le marché', en: 'the market' },
          { fr: "l'argent", en: 'the money' },
          { fr: 'Le marché est loin ?', en: 'Is the market far?' },
        ],
      },
      {
        title: { en: 'Getting around', fr: 'Se déplacer' },
        phrases: [
          { fr: 'Je prends le taxi', en: 'I take the taxi' },
          { fr: 'Arrêtez-vous ici', en: 'Stop here' },
          { fr: "C'est à gauche", en: 'It is on the left' },
          { fr: "C'est à droite", en: 'It is on the right' },
          { fr: 'Tout droit', en: 'Straight ahead' },
        ],
      },
    ],
  },
  {
    title: { en: 'Scholarships and studying abroad', fr: "Les bourses et les études à l'étranger" },
    level: 'A2',
    lessons: [
      {
        title: { en: 'Applying', fr: 'Postuler' },
        phrases: [
          { fr: 'la bourse', en: 'the scholarship' },
          { fr: 'la lettre de motivation', en: 'the cover letter' },
          { fr: 'le relevé de notes', en: 'the transcript' },
          { fr: 'la date limite', en: 'the deadline' },
          { fr: 'Je veux postuler', en: 'I want to apply' },
        ],
      },
      {
        title: { en: 'Leaving to study', fr: 'Partir étudier' },
        phrases: [
          { fr: "J'ai besoin d'un visa", en: 'I need a visa' },
          { fr: 'Mon passeport est prêt', en: 'My passport is ready' },
          { fr: "J'ai été admis à l'université", en: 'I was admitted to the university' },
          { fr: 'Je pars en septembre', en: 'I leave in September' },
          { fr: 'Je cherche un logement près du campus', en: 'I am looking for housing near the campus' },
        ],
      },
    ],
  },
];

export const ZH_UNITS: SeedUnit<ZhPhrase>[] = [
  {
    title: { en: 'Greetings', fr: 'Salutations' },
    level: 'A1',
    lessons: [
      {
        title: { en: 'Hello and thank you', fr: 'Bonjour et merci' },
        phrases: [
          { zh: '你好', py: 'nǐ hǎo', en: 'Hello', fr: 'Bonjour' },
          { zh: '谢谢', py: 'xièxie', en: 'Thank you', fr: 'Merci' },
          { zh: '再见', py: 'zàijiàn', en: 'Goodbye', fr: 'Au revoir' },
          { zh: '对不起', py: 'duìbuqǐ', en: 'Sorry', fr: 'Pardon' },
          { zh: '没关系', py: 'méi guānxi', en: 'It is okay', fr: "Ce n'est pas grave" },
        ],
      },
      {
        title: { en: 'About me', fr: 'Me présenter' },
        phrases: [
          { zh: '我 叫 阿瓦', py: 'wǒ jiào Āwǎ', en: 'My name is Awa', fr: "Je m'appelle Awa" },
          { zh: '我 是 学生', py: 'wǒ shì xuésheng', en: 'I am a student', fr: 'Je suis étudiant' },
          { zh: '我 是 喀麦隆人', py: 'wǒ shì Kāmàilóngrén', en: 'I am Cameroonian', fr: 'Je suis camerounais' },
          { zh: '很 高兴 认识 你', py: 'hěn gāoxìng rènshi nǐ', en: 'Nice to meet you', fr: 'Enchanté' },
          { zh: '你 好 吗', py: 'nǐ hǎo ma', en: 'How are you?', fr: 'Comment ça va ?' },
        ],
      },
    ],
  },
  {
    title: { en: 'Numbers and campus', fr: 'Les nombres et le campus' },
    level: 'A1',
    lessons: [
      {
        title: { en: 'Numbers and money', fr: "Les nombres et l'argent" },
        phrases: [
          { zh: '一', py: 'yī', en: 'one', fr: 'un' },
          { zh: '二', py: 'èr', en: 'two', fr: 'deux' },
          { zh: '三', py: 'sān', en: 'three', fr: 'trois' },
          { zh: '十', py: 'shí', en: 'ten', fr: 'dix' },
          { zh: '多少 钱', py: 'duōshao qián', en: 'How much is it?', fr: 'Combien ça coûte ?' },
        ],
      },
      {
        title: { en: 'At the university', fr: "À l'université" },
        phrases: [
          { zh: '大学', py: 'dàxué', en: 'university', fr: 'université' },
          { zh: '图书馆', py: 'túshūguǎn', en: 'library', fr: 'bibliothèque' },
          { zh: '老师', py: 'lǎoshī', en: 'teacher', fr: 'professeur' },
          { zh: '朋友', py: 'péngyou', en: 'friend', fr: 'ami' },
          { zh: '我 去 图书馆', py: 'wǒ qù túshūguǎn', en: 'I go to the library', fr: 'Je vais à la bibliothèque' },
        ],
      },
    ],
  },
  {
    title: { en: 'Daily life', fr: 'La vie de tous les jours' },
    level: 'A1',
    lessons: [
      {
        title: { en: 'Food and a room', fr: 'Manger et se loger' },
        phrases: [
          { zh: '吃饭', py: 'chī fàn', en: 'to eat', fr: 'manger' },
          { zh: '喝 水', py: 'hē shuǐ', en: 'to drink water', fr: "boire de l'eau" },
          { zh: '房间', py: 'fángjiān', en: 'room', fr: 'chambre' },
          { zh: '我 想 租 房子', py: 'wǒ xiǎng zū fángzi', en: 'I want to rent a house', fr: 'Je veux louer une maison' },
          { zh: '太 贵 了', py: 'tài guì le', en: 'Too expensive', fr: "C'est trop cher" },
        ],
      },
      {
        title: { en: 'Useful phrases', fr: 'Phrases utiles' },
        phrases: [
          { zh: '今天', py: 'jīntiān', en: 'today', fr: "aujourd'hui" },
          { zh: '明天', py: 'míngtiān', en: 'tomorrow', fr: 'demain' },
          { zh: '厕所 在 哪里', py: 'cèsuǒ zài nǎlǐ', en: 'Where is the toilet?', fr: 'Où sont les toilettes ?' },
          { zh: '我 不 懂', py: 'wǒ bù dǒng', en: 'I do not understand', fr: 'Je ne comprends pas' },
          { zh: '请 再 说 一 遍', py: 'qǐng zài shuō yí biàn', en: 'Please say it again', fr: 'Pouvez-vous répéter ?' },
        ],
      },
    ],
  },
  {
    title: { en: 'Studying in China', fr: 'Étudier en Chine' },
    level: 'A2',
    lessons: [
      {
        title: { en: 'Scholarship words', fr: 'Le vocabulaire des bourses' },
        phrases: [
          { zh: '奖学金', py: 'jiǎngxuéjīn', en: 'scholarship', fr: 'bourse' },
          { zh: '签证', py: 'qiānzhèng', en: 'visa', fr: 'visa' },
          { zh: '护照', py: 'hùzhào', en: 'passport', fr: 'passeport' },
          { zh: '留学', py: 'liúxué', en: 'to study abroad', fr: "étudier à l'étranger" },
          { zh: '申请 奖学金', py: 'shēnqǐng jiǎngxuéjīn', en: 'to apply for a scholarship', fr: 'postuler à une bourse' },
        ],
      },
      {
        title: { en: 'My plans', fr: 'Mes projets' },
        phrases: [
          { zh: '我 想 去 中国 留学', py: 'wǒ xiǎng qù Zhōngguó liúxué', en: 'I want to study in China', fr: 'Je veux étudier en Chine' },
          { zh: '我 有 护照', py: 'wǒ yǒu hùzhào', en: 'I have a passport', fr: "J'ai un passeport" },
          { zh: '我 学 中文', py: 'wǒ xué Zhōngwén', en: 'I learn Chinese', fr: "J'apprends le chinois" },
          { zh: '我 会 说 一点 中文', py: 'wǒ huì shuō yìdiǎn Zhōngwén', en: 'I can speak a little Chinese', fr: 'Je parle un peu chinois' },
          { zh: '北京 大学', py: 'Běijīng dàxué', en: 'Peking University', fr: 'Université de Pékin' },
        ],
      },
    ],
  },
];
