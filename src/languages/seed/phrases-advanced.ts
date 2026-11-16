// Starter units from A2 to C2, added after the first units of each course. Same shapes as
// phrases.ts. French/English pairs serve both courses (French for English speakers and English
// for French speakers): `tips.en` explains French, `tips.fr` explains English.
// Chinese: words are separated by spaces and each pinyin group lines up with its word.
import type { Pair, SeedUnit, ZhPhrase } from './phrases';

export const FR_EN_ADVANCED: SeedUnit<Pair>[] = [
  // ── A2 ──
  {
    title: { en: 'Health and services', fr: 'Santé et services' },
    level: 'A2',
    tips: {
      en: 'Pain uses avoir mal à: j\'ai mal à la tête, j\'ai mal au ventre (à + le = au). Depuis + present tense says how long something has lasted: j\'ai de la fièvre depuis hier. Je voudrais is the polite way to ask for something.',
      fr: 'For a duration that continues, English uses the present perfect: I have had a fever since yesterday (et non I have a fever since). « Prendre rendez-vous » se dit make an appointment. I would like est la forme polie de I want.',
    },
    lessons: [
      {
        title: { en: 'At the doctor', fr: 'Chez le médecin' },
        phrases: [
          { fr: "J'ai mal à la tête", en: 'I have a headache' },
          { fr: "J'ai de la fièvre depuis hier", en: 'I have had a fever since yesterday' },
          { fr: 'Où est la pharmacie la plus proche ?', en: 'Where is the nearest pharmacy?' },
          { fr: 'Il faut prendre ce médicament deux fois par jour', en: 'You must take this medicine twice a day' },
          { fr: 'Je voudrais prendre rendez-vous', en: 'I would like to make an appointment' },
        ],
      },
      {
        title: { en: 'Bank and phone', fr: 'Banque et téléphone' },
        phrases: [
          { fr: 'Je voudrais ouvrir un compte', en: 'I would like to open an account' },
          { fr: 'Ma carte ne marche pas', en: 'My card does not work' },
          { fr: "J'ai besoin de recharger mon téléphone", en: 'I need to top up my phone' },
          { fr: 'Le loyer est payé chaque mois', en: 'The rent is paid every month' },
          { fr: 'Pouvez-vous me rappeler plus tard ?', en: 'Can you call me back later?' },
        ],
      },
    ],
  },
  // ── B1 ──
  {
    title: { en: 'Telling stories and making plans', fr: 'Raconter et faire des projets' },
    level: 'B1',
    tips: {
      en: 'Passé composé tells what happened (je suis allé, nous avons mangé); imparfait describes the background (c\'était, il faisait beau). Verbs of movement like aller take être. The future is simple: je ferai, je partirai. Si + present, then future: si j\'obtiens la bourse, je partirai.',
      fr: 'The simple past tells finished events: I went, we ate (verbes irréguliers à apprendre : go → went, eat → ate). Never avec le past perfect : I had never seen. Le futur se fait avec will : I will go. If + présent, puis will : If I get the scholarship, I will go.',
    },
    lessons: [
      {
        title: { en: 'Last weekend', fr: 'Le week-end dernier' },
        phrases: [
          { fr: 'Le week-end dernier, je suis allé à Kribi', en: 'Last weekend I went to Kribi' },
          { fr: 'Nous avons mangé du poisson braisé sur la plage', en: 'We ate grilled fish on the beach' },
          { fr: 'Il a plu toute la journée', en: 'It rained all day' },
          { fr: "Je n'avais jamais vu la mer avant", en: 'I had never seen the sea before' },
          { fr: "C'était un voyage inoubliable", en: 'It was an unforgettable trip' },
        ],
      },
      {
        title: { en: 'Plans and wishes', fr: 'Projets et envies' },
        phrases: [
          { fr: "L'année prochaine, je ferai un master", en: "Next year I will do a master's degree" },
          { fr: "J'aimerais travailler dans une entreprise internationale", en: 'I would like to work for an international company' },
          { fr: "Si j'obtiens la bourse, je partirai au Canada", en: 'If I get the scholarship I will go to Canada' },
          { fr: 'Je compte économiser pour acheter un ordinateur', en: 'I plan to save money to buy a computer' },
          { fr: 'Mon rêve est de créer ma propre entreprise', en: 'My dream is to start my own company' },
        ],
      },
    ],
  },
  {
    title: { en: 'Opinions and problems', fr: 'Avis et problèmes' },
    level: 'B1',
    tips: {
      en: 'Give an opinion with à mon avis, je pense que, je trouve que. Être d\'accord avec quelqu\'un means to agree. Pourriez-vous (conditional) is more polite than pouvez-vous. Depuis ce matin + present: l\'eau est coupée depuis ce matin.',
      fr: 'Pour donner son avis : In my opinion, I think (that). Agree s\'emploie sans « be » : I agree, I do not agree (et non I am agree). Could you est plus poli que can you. « Pas encore » se dit not … yet, à la fin : He has not fixed it yet.',
    },
    lessons: [
      {
        title: { en: 'Giving your opinion', fr: 'Donner son avis' },
        phrases: [
          { fr: 'À mon avis, le loyer est trop cher', en: 'In my opinion the rent is too expensive' },
          { fr: "Je pense que c'est une bonne idée", en: 'I think it is a good idea' },
          { fr: "Je ne suis pas d'accord avec toi", en: 'I do not agree with you' },
          { fr: 'Ça dépend de la distance du campus', en: 'It depends on the distance from the campus' },
          { fr: 'Je préfère vivre en colocation', en: 'I prefer to live in a shared flat' },
        ],
      },
      {
        title: { en: 'Solving a problem', fr: 'Régler un problème' },
        phrases: [
          { fr: "L'eau est coupée depuis ce matin", en: 'The water has been cut off since this morning' },
          { fr: "Le propriétaire n'a pas encore réparé la porte", en: 'The landlord has not fixed the door yet' },
          { fr: "Pourriez-vous envoyer quelqu'un aujourd'hui ?", en: 'Could you send someone today?' },
          { fr: 'Je vous ai déjà écrit deux fois', en: 'I have already written to you twice' },
          { fr: 'Merci de régler ce problème rapidement', en: 'Please solve this problem quickly' },
        ],
      },
    ],
  },
  // ── B2 ──
  {
    title: { en: 'Work and internships', fr: 'Travail et stages' },
    level: 'B2',
    tips: {
      en: 'Effectuer un stage is the formal way to say "do an internship". Il faudrait (conditional of il faut) softens an obligation. Être chargé de means to be in charge of. In emails, the present often stands for the near future: je vous envoie le rapport avant midi.',
      fr: 'Internship = stage. Be in charge of = être chargé de. Pour un délai : meet a deadline (respecter un délai). Le passif est courant au travail : The meeting has been postponed. Should adoucit une obligation, comme « il faudrait ».',
    },
    lessons: [
      {
        title: { en: 'Job interview', fr: "L'entretien d'embauche" },
        phrases: [
          { fr: 'Je suis motivé par les défis', en: 'I am motivated by challenges' },
          { fr: "J'ai effectué un stage de six mois dans une banque", en: 'I did a six month internship in a bank' },
          { fr: 'Mon principal point fort est le travail en équipe', en: 'My main strength is teamwork' },
          { fr: 'Je sais travailler sous pression', en: 'I can work under pressure' },
          { fr: "Quelles sont les perspectives d'évolution ?", en: 'What are the opportunities for promotion?' },
        ],
      },
      {
        title: { en: 'At work', fr: 'Au travail' },
        phrases: [
          { fr: 'La réunion a été reportée à jeudi', en: 'The meeting has been postponed to Thursday' },
          { fr: 'Je vous envoie le rapport avant midi', en: 'I will send you the report before noon' },
          { fr: 'Il faudrait respecter les délais', en: 'We should meet the deadlines' },
          { fr: 'Pouvons-nous en discuter demain ?', en: 'Can we discuss it tomorrow?' },
          { fr: 'Je suis chargé du suivi des clients', en: 'I am in charge of customer follow up' },
        ],
      },
    ],
  },
  {
    title: { en: 'Society and debate', fr: 'Société et débat' },
    level: 'B2',
    tips: {
      en: 'Weigh both sides with d\'un côté … de l\'autre. Bien que and il est essentiel que are followed by the subjunctive: bien que ce soit difficile, il est essentiel que chacun ait accès. Davantage means "more" and comes after the verb.',
      fr: 'On the one hand … on the other hand pour peser le pour et le contre. Although = bien que, mais sans subjonctif en anglais : Although it is difficult. It is worth it = ça vaut la peine. More and more = de plus en plus.',
    },
    lessons: [
      {
        title: { en: 'Pros and cons', fr: 'Le pour et le contre' },
        phrases: [
          { fr: "D'un côté, la ville offre plus d'opportunités", en: 'On the one hand the city offers more opportunities' },
          { fr: "De l'autre, la vie y coûte plus cher", en: 'On the other hand life there costs more' },
          { fr: 'Bien que ce soit difficile, ça vaut la peine', en: 'Although it is difficult it is worth it' },
          { fr: "Il est essentiel que chacun ait accès à l'éducation", en: 'It is essential that everyone has access to education' },
          { fr: 'Les réseaux sociaux ont changé notre façon de communiquer', en: 'Social media has changed the way we communicate' },
        ],
      },
      {
        title: { en: 'The environment', fr: "L'environnement" },
        phrases: [
          { fr: 'Il faut réduire les déchets plastiques', en: 'We must reduce plastic waste' },
          { fr: 'La déforestation menace nos forêts', en: 'Deforestation threatens our forests' },
          { fr: 'Les jeunes sont de plus en plus engagés', en: 'Young people are more and more committed' },
          { fr: "Nous devrions utiliser davantage l'énergie solaire", en: 'We should use more solar energy' },
          { fr: 'Chaque geste compte', en: 'Every action counts' },
        ],
      },
    ],
  },
  // ── C1 ──
  {
    title: { en: 'Academic language', fr: 'La langue universitaire' },
    level: 'C1',
    tips: {
      en: 'Academic French prefers set phrases: viser à (to aim to), il convient de (it is worth / one should), force est de constater que (one has to admit). En revanche contrasts two ideas. Sans pour autant + infinitive concedes a point without giving it up.',
      fr: 'L\'anglais universitaire aime les verbes précis : aim to, suggest, highlight, dispute, raise a question. However se place en tête de phrase. One has to admit = force est de constater. Les phrases sont plus courtes qu\'en français : coupez les longues phrases.',
    },
    lessons: [
      {
        title: { en: 'Writing a thesis', fr: 'Rédiger un mémoire' },
        phrases: [
          { fr: "Cette étude vise à examiner l'accès au logement étudiant", en: 'This study aims to examine access to student housing' },
          { fr: 'Les résultats suggèrent une forte corrélation', en: 'The results suggest a strong correlation' },
          { fr: 'Il convient de souligner les limites de cette méthode', en: 'It is worth highlighting the limits of this method' },
          { fr: 'En revanche, d\'autres auteurs contestent cette hypothèse', en: 'However other authors dispute this hypothesis' },
          { fr: "Nous en concluons que des mesures s'imposent", en: 'We conclude that action is needed' },
        ],
      },
      {
        title: { en: 'Presenting and arguing', fr: 'Présenter et argumenter' },
        phrases: [
          { fr: 'Permettez-moi de revenir sur ce point', en: 'Allow me to come back to this point' },
          { fr: "Force est de constater que la situation s'est dégradée", en: 'One has to admit that the situation has worsened' },
          { fr: 'Cela soulève une question fondamentale', en: 'This raises a fundamental question' },
          { fr: 'Sans pour autant nier les progrès accomplis', en: 'Without denying the progress made' },
          { fr: 'Pour conclure, je voudrais remercier le jury', en: 'To conclude I would like to thank the jury' },
        ],
      },
    ],
  },
  {
    title: { en: 'Tact and formal style', fr: 'Tact et registre soutenu' },
    level: 'C1',
    tips: {
      en: 'Formal letters have fixed formulas: je me permets de vous contacter, je vous saurais gré de, veuillez trouver ci-joint, veuillez agréer mes salutations distinguées. To soften a disagreement, use il me semble que or the conditional: je ne voudrais pas vous déranger.',
      fr: 'Les lettres formelles ont leurs formules : I am writing to you regarding, I would be grateful if, Please find attached, I look forward to your reply. Yours faithfully quand on ne connaît pas le nom, Yours sincerely quand on le connaît. It seems to me adoucit un désaccord.',
    },
    lessons: [
      {
        title: { en: 'Formal letters', fr: 'Lettres formelles' },
        phrases: [
          { fr: 'Je me permets de vous contacter au sujet de ma candidature', en: 'I am writing to you regarding my application' },
          { fr: 'Je vous saurais gré de bien vouloir me répondre', en: 'I would be grateful if you could reply to me' },
          { fr: 'Veuillez trouver ci-joint mon curriculum vitae', en: 'Please find attached my CV' },
          { fr: "Dans l'attente de votre réponse", en: 'I look forward to your reply' },
          { fr: 'Veuillez agréer mes salutations distinguées', en: 'Yours faithfully' },
        ],
      },
      {
        title: { en: 'Saying it with tact', fr: 'Dire les choses avec tact' },
        phrases: [
          { fr: "Il me semble qu'il y a un malentendu", en: 'It seems to me that there is a misunderstanding' },
          { fr: 'Je ne voudrais pas vous déranger', en: 'I would not want to disturb you' },
          { fr: "Ce n'est pas tout à fait ce que je voulais dire", en: 'That is not quite what I meant' },
          { fr: "Auriez-vous l'amabilité de m'aider ?", en: 'Would you be kind enough to help me?' },
          { fr: "Je comprends votre point de vue, toutefois j'ai encore des doutes", en: 'I understand your point of view however I still have doubts' },
        ],
      },
    ],
  },
  // ── C2 ──
  {
    title: { en: 'Idioms and sayings', fr: 'Expressions et proverbes' },
    level: 'C2',
    tips: {
      en: 'Idioms rarely translate word for word: il pleut des cordes is literally "it rains ropes". Learn each one with its English equivalent. Proverbs often drop the article: qui ne risque rien n\'a rien.',
      fr: 'Les expressions se traduisent rarement mot à mot : It is raining cats and dogs = il pleut des cordes. Apprenez chaque expression avec son équivalent français. Cost an arm and a leg = coûter les yeux de la tête.',
    },
    lessons: [
      {
        title: { en: 'Everyday idioms', fr: 'Expressions courantes' },
        phrases: [
          { fr: 'Il pleut des cordes', en: 'It is raining cats and dogs' },
          { fr: "Ce n'est pas la mer à boire", en: 'It is not the end of the world' },
          { fr: 'Ça coûte les yeux de la tête', en: 'It costs an arm and a leg' },
          { fr: "J'ai le cafard", en: 'I feel blue' },
          { fr: 'Il m\'a posé un lapin', en: 'He stood me up' },
        ],
      },
      {
        title: { en: 'Proverbs', fr: 'Proverbes' },
        phrases: [
          { fr: "Petit à petit, l'oiseau fait son nid", en: 'Rome was not built in a day' },
          { fr: 'Mieux vaut tard que jamais', en: 'Better late than never' },
          { fr: "Qui ne risque rien n'a rien", en: 'Nothing ventured nothing gained' },
          { fr: "L'habit ne fait pas le moine", en: 'Do not judge a book by its cover' },
          { fr: 'Les murs ont des oreilles', en: 'The walls have ears' },
        ],
      },
    ],
  },
  {
    title: { en: 'Mastery', fr: 'Maîtrise de la langue' },
    level: 'C2',
    tips: {
      en: 'Advanced structures: ne pas être sans savoir (to be well aware), pour peu que + subjunctive (if only), quoi qu\'il en soit (be that as it may), il s\'en est fallu de peu (very nearly), avoir beau + infinitive (however much). Spoken French loves short set phrases: on fait avec, tant pis.',
      fr: 'Structures avancées : be well aware, if you take any interest in it, be that as it may, very nearly, however much + sujet + verbe. L\'anglais parlé aime les phrases courtes : We make do, Never mind, It means a lot to me.',
    },
    lessons: [
      {
        title: { en: 'Subtle meanings', fr: 'Le sens implicite' },
        phrases: [
          { fr: "Il n'est pas sans savoir que le délai est dépassé", en: 'He is well aware that the deadline has passed' },
          { fr: "Pour peu qu'on s'y intéresse, le sujet est passionnant", en: 'If you take any interest in it the subject is fascinating' },
          { fr: "Quoi qu'il en soit, la décision est prise", en: 'Be that as it may the decision has been made' },
          { fr: "Il s'en est fallu de peu qu'il rate son avion", en: 'He very nearly missed his flight' },
          { fr: "Elle a beau insister, rien n'y fait", en: 'However much she insists nothing works' },
        ],
      },
      {
        title: { en: 'Speaking like a native', fr: 'Parler comme un natif' },
        phrases: [
          { fr: "Je n'en reviens pas", en: 'I cannot believe it' },
          { fr: 'On fait avec', en: 'We make do' },
          { fr: 'Ça me tient à cœur', en: 'It means a lot to me' },
          { fr: "Il ne faut pas vendre la peau de l'ours avant de l'avoir tué", en: 'Do not count your chickens before they hatch' },
          { fr: 'Tant pis, on verra bien', en: 'Never mind we will see' },
        ],
      },
    ],
  },
];

export const ZH_ADVANCED: SeedUnit<ZhPhrase>[] = [
  // ── A2 ──
  {
    title: { en: 'Health and shopping', fr: 'Santé et achats' },
    level: 'A2',
    tips: {
      en: '了 after a verb or sentence marks a change or something completed: 我发烧了 (I have a fever now). 太…了 means "too…": 太贵了. Measure words come between a number and a noun: 一件衣服, 两次. 一 changes tone: yí before a 4th tone, yì before the others.',
      fr: '了 après un verbe ou une phrase marque un changement ou une action finie : 我发烧了 (j\'ai de la fièvre maintenant). 太…了 veut dire « trop » : 太贵了. Les classificateurs se placent entre le nombre et le nom : 一件衣服, 两次. 一 change de ton : yí devant un 4e ton, yì devant les autres.',
    },
    lessons: [
      {
        title: { en: 'Feeling unwell', fr: 'Ne pas se sentir bien' },
        phrases: [
          { zh: '我 头 疼', py: 'wǒ tóu téng', en: 'I have a headache', fr: "J'ai mal à la tête" },
          { zh: '我 发烧 了', py: 'wǒ fāshāo le', en: 'I have a fever', fr: "J'ai de la fièvre" },
          { zh: '医院 在 哪儿', py: 'yīyuàn zài nǎr', en: 'Where is the hospital?', fr: "Où est l'hôpital ?" },
          { zh: '我 要 看 医生', py: 'wǒ yào kàn yīshēng', en: 'I need to see a doctor', fr: 'Je dois voir un médecin' },
          { zh: '这 个 药 一 天 吃 两 次', py: 'zhè ge yào yì tiān chī liǎng cì', en: 'Take this medicine twice a day', fr: 'Prenez ce médicament deux fois par jour' },
        ],
      },
      {
        title: { en: 'Buying things', fr: 'Faire des achats' },
        phrases: [
          { zh: '太 贵 了', py: 'tài guì le', en: 'It is too expensive', fr: "C'est trop cher" },
          { zh: '可以 便宜 一点儿 吗', py: 'kěyǐ piányi yìdiǎnr ma', en: 'Can it be a bit cheaper?', fr: 'Vous pouvez faire un peu moins cher ?' },
          { zh: '我 想 买 一 件 衣服', py: 'wǒ xiǎng mǎi yí jiàn yīfu', en: 'I want to buy some clothes', fr: 'Je veux acheter un vêtement' },
          { zh: '可以 用 手机 付款 吗', py: 'kěyǐ yòng shǒujī fùkuǎn ma', en: 'Can I pay by phone?', fr: 'Je peux payer avec mon téléphone ?' },
          { zh: '我 只是 看看', py: 'wǒ zhǐshì kànkan', en: 'I am just looking', fr: 'Je regarde seulement' },
        ],
      },
    ],
  },
  // ── B1 ──
  {
    title: { en: 'Experiences and plans', fr: 'Expériences et projets' },
    level: 'B1',
    tips: {
      en: '过 after a verb means "have ever done": 我去过北京. 没 + verb + 过 is "have never": 从来没吃过. Time words come before the verb: 昨天我…, 明年我…. 如果…就… makes "if… then…". 打算 means "to plan to".',
      fr: '过 après un verbe veut dire « avoir déjà fait » : 我去过北京. 没 + verbe + 过 = « n\'avoir jamais » : 从来没吃过. Les mots de temps se placent avant le verbe : 昨天我…, 明年我…. 如果…就… exprime « si… alors… ». 打算 veut dire « compter faire ».',
    },
    lessons: [
      {
        title: { en: 'What I did', fr: "Ce que j'ai fait" },
        phrases: [
          { zh: '我 去过 北京', py: 'wǒ qùguo Běijīng', en: 'I have been to Beijing', fr: 'Je suis déjà allé à Pékin' },
          { zh: '昨天 我 跟 朋友 去 看 电影 了', py: 'zuótiān wǒ gēn péngyou qù kàn diànyǐng le', en: 'Yesterday I went to see a film with friends', fr: 'Hier je suis allé voir un film avec des amis' },
          { zh: '我 学 了 两 年 中文', py: 'wǒ xué le liǎng nián Zhōngwén', en: 'I have studied Chinese for two years', fr: "J'ai étudié le chinois pendant deux ans" },
          { zh: '那 次 旅行 非常 有意思', py: 'nà cì lǚxíng fēicháng yǒuyìsi', en: 'That trip was very interesting', fr: 'Ce voyage était très intéressant' },
          { zh: '我 从来 没 吃过 北京 烤鸭', py: 'wǒ cónglái méi chīguo Běijīng kǎoyā', en: 'I have never eaten Peking duck', fr: "Je n'ai jamais mangé de canard laqué" },
        ],
      },
      {
        title: { en: 'My future', fr: 'Mon avenir' },
        phrases: [
          { zh: '明年 我 打算 去 中国 留学', py: 'míngnián wǒ dǎsuàn qù Zhōngguó liúxué', en: 'Next year I plan to study in China', fr: "L'année prochaine je compte étudier en Chine" },
          { zh: '如果 我 拿到 奖学金 我 就 去 上海', py: 'rúguǒ wǒ nádào jiǎngxuéjīn wǒ jiù qù Shànghǎi', en: 'If I get the scholarship I will go to Shanghai', fr: "Si j'obtiens la bourse j'irai à Shanghai" },
          { zh: '我 希望 以后 当 工程师', py: 'wǒ xīwàng yǐhòu dāng gōngchéngshī', en: 'I hope to become an engineer later', fr: "J'espère devenir ingénieur plus tard" },
          { zh: '我 想 学好 中文', py: 'wǒ xiǎng xuéhǎo Zhōngwén', en: 'I want to learn Chinese well', fr: 'Je veux bien apprendre le chinois' },
          { zh: '毕业 以后 我 要 回 喀麦隆 工作', py: 'bìyè yǐhòu wǒ yào huí Kāmàilóng gōngzuò', en: 'After graduating I will go back to work in Cameroon', fr: 'Après mes études je rentrerai travailler au Cameroun' },
        ],
      },
    ],
  },
  {
    title: { en: 'Opinions and problems', fr: 'Avis et problèmes' },
    level: 'B1',
    tips: {
      en: '我觉得 is the everyday "I think"; 我认为 is more formal. 坏了 means "broken". A verb + 一下 softens a request: 修一下. 已经…了 means "already". 请尽快 is a polite "as soon as possible".',
      fr: '我觉得 est le « je trouve » de tous les jours ; 我认为 est plus soutenu. 坏了 veut dire « en panne ». Verbe + 一下 adoucit une demande : 修一下. 已经…了 veut dire « déjà ». 请尽快 est un « au plus vite » poli.',
    },
    lessons: [
      {
        title: { en: 'What I think', fr: 'Ce que je pense' },
        phrases: [
          { zh: '我 觉得 这 个 房间 太 小 了', py: 'wǒ juéde zhè ge fángjiān tài xiǎo le', en: 'I think this room is too small', fr: 'Je trouve que cette chambre est trop petite' },
          { zh: '我 同意 你 的 看法', py: 'wǒ tóngyì nǐ de kànfǎ', en: 'I agree with your view', fr: "Je suis d'accord avec ton avis" },
          { zh: '我 不 这么 认为', py: 'wǒ bú zhème rènwéi', en: 'I do not think so', fr: 'Je ne pense pas' },
          { zh: '这 要 看 情况', py: 'zhè yào kàn qíngkuàng', en: 'It depends on the situation', fr: 'Ça dépend de la situation' },
          { zh: '我 比较 喜欢 住 在 学校 附近', py: 'wǒ bǐjiào xǐhuan zhù zài xuéxiào fùjìn', en: 'I prefer living near the school', fr: "Je préfère habiter près de l'école" },
        ],
      },
      {
        title: { en: 'Something is wrong', fr: 'Quelque chose ne va pas' },
        phrases: [
          { zh: '空调 坏 了', py: 'kōngtiáo huài le', en: 'The air conditioner is broken', fr: 'La climatisation est en panne' },
          { zh: '房间 里 没有 热水', py: 'fángjiān lǐ méiyǒu rèshuǐ', en: 'There is no hot water in the room', fr: "Il n'y a pas d'eau chaude dans la chambre" },
          { zh: '你 能 帮 我 修 一下 吗', py: 'nǐ néng bāng wǒ xiū yíxià ma', en: 'Can you help me fix it?', fr: "Tu peux m'aider à le réparer ?" },
          { zh: '我 已经 说过 两 次 了', py: 'wǒ yǐjīng shuōguo liǎng cì le', en: 'I have already said it twice', fr: "Je l'ai déjà dit deux fois" },
          { zh: '请 尽快 解决 这 个 问题', py: 'qǐng jǐnkuài jiějué zhè ge wèntí', en: 'Please solve this problem as soon as possible', fr: 'Merci de régler ce problème au plus vite' },
        ],
      },
    ],
  },
  // ── B2 ──
  {
    title: { en: 'Work and study', fr: 'Travail et études' },
    level: 'B2',
    tips: {
      en: '对…感兴趣 means "interested in…". 把 moves the object before the verb when you do something to it: 把报告发给你. 负责 means "to be in charge of". 吧 at the end makes a suggestion: 明天再讨论吧.',
      fr: '对…感兴趣 veut dire « s\'intéresser à… ». 把 place l\'objet avant le verbe quand on agit dessus : 把报告发给你. 负责 veut dire « être chargé de ». 吧 en fin de phrase fait une proposition : 明天再讨论吧.',
    },
    lessons: [
      {
        title: { en: 'The interview', fr: "L'entretien" },
        phrases: [
          { zh: '我 对 这 个 工作 很 感兴趣', py: 'wǒ duì zhè ge gōngzuò hěn gǎnxìngqù', en: 'I am very interested in this job', fr: "Ce poste m'intéresse beaucoup" },
          { zh: '我 在 一 家 公司 实习 过 半 年', py: 'wǒ zài yì jiā gōngsī shíxí guo bàn nián', en: 'I did a six month internship at a company', fr: "J'ai fait un stage de six mois dans une entreprise" },
          { zh: '我 的 优点 是 认真 负责', py: 'wǒ de yōudiǎn shì rènzhēn fùzé', en: 'My strength is that I am serious and responsible', fr: 'Mon point fort est que je suis sérieux et responsable' },
          { zh: '我 能 承受 工作 压力', py: 'wǒ néng chéngshòu gōngzuò yālì', en: 'I can handle work pressure', fr: 'Je supporte la pression au travail' },
          { zh: '请问 什么 时候 能 知道 结果', py: 'qǐngwèn shénme shíhou néng zhīdào jiéguǒ', en: 'May I ask when I will know the result?', fr: "Puis-je savoir quand j'aurai la réponse ?" },
        ],
      },
      {
        title: { en: 'In the office', fr: 'Au bureau' },
        phrases: [
          { zh: '会议 推迟 到 星期四 了', py: 'huìyì tuīchí dào xīngqīsì le', en: 'The meeting has been postponed to Thursday', fr: 'La réunion a été reportée à jeudi' },
          { zh: '我 中午 以前 把 报告 发 给 你', py: 'wǒ zhōngwǔ yǐqián bǎ bàogào fā gěi nǐ', en: 'I will send you the report before noon', fr: "Je t'envoie le rapport avant midi" },
          { zh: '我们 必须 按时 完成', py: 'wǒmen bìxū ànshí wánchéng', en: 'We must finish on time', fr: 'Nous devons finir à temps' },
          { zh: '这 件 事 我们 明天 再 讨论 吧', py: 'zhè jiàn shì wǒmen míngtiān zài tǎolùn ba', en: 'Let us discuss this tomorrow', fr: 'Discutons-en demain' },
          { zh: '我 负责 跟 客户 联系', py: 'wǒ fùzé gēn kèhù liánxì', en: 'I am in charge of contacting clients', fr: 'Je suis chargé du contact avec les clients' },
        ],
      },
    ],
  },
  {
    title: { en: 'Society', fr: 'Société' },
    level: 'B2',
    tips: {
      en: '一方面…另一方面… weighs two sides. 虽然…但是… means "although… (but)…": Chinese keeps both words. 越来越 + adjective means "more and more". 对…来说 / 对…很重要 says who something matters to.',
      fr: '一方面…另一方面… pèse le pour et le contre. 虽然…但是… veut dire « bien que… » : le chinois garde les deux mots. 越来越 + adjectif = « de plus en plus ». 对…很重要 dit pour qui c\'est important.',
    },
    lessons: [
      {
        title: { en: 'Pros and cons', fr: 'Le pour et le contre' },
        phrases: [
          { zh: '一方面 大城市 机会 多', py: 'yìfāngmiàn dàchéngshì jīhuì duō', en: 'On the one hand big cities have more opportunities', fr: "D'un côté les grandes villes offrent plus d'opportunités" },
          { zh: '另一方面 生活 成本 很 高', py: 'lìngyìfāngmiàn shēnghuó chéngběn hěn gāo', en: 'On the other hand the cost of living is high', fr: "De l'autre le coût de la vie est élevé" },
          { zh: '虽然 很 难 但是 值得', py: 'suīrán hěn nán dànshì zhíde', en: 'Although it is hard it is worth it', fr: 'Bien que ce soit difficile ça vaut la peine' },
          { zh: '教育 对 每 个 人 都 很 重要', py: 'jiàoyù duì měi ge rén dōu hěn zhòngyào', en: 'Education is important for everyone', fr: "L'éducation est importante pour tout le monde" },
          { zh: '社交 媒体 改变 了 我们 的 生活', py: 'shèjiāo méitǐ gǎibiàn le wǒmen de shēnghuó', en: 'Social media has changed our lives', fr: 'Les réseaux sociaux ont changé nos vies' },
        ],
      },
      {
        title: { en: 'The environment', fr: "L'environnement" },
        phrases: [
          { zh: '我们 应该 保护 环境', py: 'wǒmen yīnggāi bǎohù huánjìng', en: 'We should protect the environment', fr: "Nous devrions protéger l'environnement" },
          { zh: '要 减少 使用 塑料袋', py: 'yào jiǎnshǎo shǐyòng sùliàodài', en: 'We need to use fewer plastic bags', fr: 'Il faut utiliser moins de sacs plastiques' },
          { zh: '空气 污染 越来越 严重', py: 'kōngqì wūrǎn yuèláiyuè yánzhòng', en: 'Air pollution is getting worse and worse', fr: "La pollution de l'air est de plus en plus grave" },
          { zh: '太阳能 是 一 种 清洁 能源', py: 'tàiyángnéng shì yì zhǒng qīngjié néngyuán', en: 'Solar energy is a clean energy', fr: "L'énergie solaire est une énergie propre" },
          { zh: '保护 环境 从 我 做起', py: 'bǎohù huánjìng cóng wǒ zuòqǐ', en: 'Protecting the environment starts with me', fr: "Protéger l'environnement commence par moi" },
        ],
      },
    ],
  },
  // ── C1 ──
  {
    title: { en: 'Academic Chinese', fr: 'Le chinois universitaire' },
    level: 'C1',
    tips: {
      en: 'Written Chinese uses compact formal words: 本 (this), 旨在 (aims to), 表明 (shows), 较 (rather), 由此可见 (it follows that). 值得注意的是 introduces an important remark. 然而 is a formal "however".',
      fr: 'Le chinois écrit utilise des mots formels et courts : 本 (ce, cette), 旨在 (vise à), 表明 (montre), 较 (assez), 由此可见 (il en ressort que). 值得注意的是 introduit une remarque importante. 然而 est un « cependant » soutenu.',
    },
    lessons: [
      {
        title: { en: 'Research', fr: 'La recherche' },
        phrases: [
          { zh: '本 研究 旨在 分析 学生 住房 问题', py: 'běn yánjiū zhǐzài fēnxī xuésheng zhùfáng wèntí', en: 'This study aims to examine student housing problems', fr: 'Cette étude vise à examiner les problèmes de logement étudiant' },
          { zh: '结果 表明 两者 之间 存在 密切 关系', py: 'jiéguǒ biǎomíng liǎngzhě zhījiān cúnzài mìqiè guānxi', en: 'The results show a close relationship between the two', fr: 'Les résultats montrent un lien étroit entre les deux' },
          { zh: '值得 注意 的 是 样本 较 小', py: 'zhíde zhùyì de shì yàngběn jiào xiǎo', en: 'It is worth noting that the sample is small', fr: "Il faut noter que l'échantillon est petit" },
          { zh: '然而 也 有 学者 提出 不同 意见', py: 'rán\'ér yě yǒu xuézhě tíchū bùtóng yìjiàn', en: 'However some scholars disagree', fr: 'Cependant certains chercheurs ne sont pas d\'accord' },
          { zh: '由此 可见 必须 采取 措施', py: 'yóucǐ kějiàn bìxū cǎiqǔ cuòshī', en: 'It follows that measures must be taken', fr: "Il en ressort que des mesures s'imposent" },
        ],
      },
      {
        title: { en: 'Presenting', fr: 'Présenter' },
        phrases: [
          { zh: '下面 我 简单 介绍 一下', py: 'xiàmiàn wǒ jiǎndān jièshào yíxià', en: 'Let me give a brief introduction', fr: 'Je vais faire une brève présentation' },
          { zh: '关于 这 一 点 我 想 补充 几 句', py: 'guānyú zhè yì diǎn wǒ xiǎng bǔchōng jǐ jù', en: 'On this point I would like to add a few words', fr: 'Sur ce point je voudrais ajouter quelques mots' },
          { zh: '这 引出 了 一 个 根本 问题', py: 'zhè yǐnchū le yí ge gēnběn wèntí', en: 'This raises a fundamental question', fr: 'Cela soulève une question fondamentale' },
          { zh: '总的来说 情况 有所 改善', py: 'zǒngdeláishuō qíngkuàng yǒusuǒ gǎishàn', en: 'Overall the situation has improved', fr: "Dans l'ensemble la situation s'est améliorée" },
          { zh: '最后 感谢 各位 老师', py: 'zuìhòu gǎnxiè gèwèi lǎoshī', en: 'Finally I thank all the teachers', fr: 'Enfin je remercie tous les professeurs' },
        ],
      },
    ],
  },
  {
    title: { en: 'Tact and formality', fr: 'Tact et registre' },
    level: 'C1',
    tips: {
      en: '您 is the polite "you"; use it with teachers and strangers. Letters open with 尊敬的 + title and close with 此致 敬礼. 恐怕 ("I am afraid") and 不好意思 soften what follows. 麻烦您 is a polite way to ask a favour.',
      fr: '您 est le « vous » de politesse ; employez-le avec les professeurs et les inconnus. Les lettres commencent par 尊敬的 + titre et finissent par 此致 敬礼. 恐怕 (« je crains que ») et 不好意思 adoucissent la suite. 麻烦您 sert à demander poliment un service.',
    },
    lessons: [
      {
        title: { en: 'Formal writing', fr: "L'écrit formel" },
        phrases: [
          { zh: '尊敬 的 王 教授', py: 'zūnjìng de Wáng jiàoshòu', en: 'Dear Professor Wang', fr: 'Cher professeur Wang' },
          { zh: '冒昧 给 您 写信', py: 'màomèi gěi nín xiěxìn', en: 'Forgive me for writing to you', fr: 'Pardonnez-moi de vous écrire' },
          { zh: '附件 是 我 的 简历', py: 'fùjiàn shì wǒ de jiǎnlì', en: 'Attached is my CV', fr: 'Vous trouverez mon CV en pièce jointe' },
          { zh: '期待 您 的 回复', py: 'qīdài nín de huífù', en: 'I look forward to your reply', fr: 'Dans l\'attente de votre réponse' },
          { zh: '此致 敬礼', py: 'cǐzhì jìnglǐ', en: 'Yours faithfully', fr: 'Veuillez agréer mes salutations distinguées' },
        ],
      },
      {
        title: { en: 'Saying it politely', fr: 'Dire les choses poliment' },
        phrases: [
          { zh: '恐怕 这里 有 点儿 误会', py: 'kǒngpà zhèlǐ yǒu diǎnr wùhuì', en: 'I am afraid there is a misunderstanding here', fr: "Je crains qu'il y ait un malentendu" },
          { zh: '不好意思 打扰 您 一下', py: 'bùhǎoyìsi dǎrǎo nín yíxià', en: 'Sorry to bother you', fr: 'Désolé de vous déranger' },
          { zh: '我 不是 这个 意思', py: 'wǒ búshì zhège yìsi', en: 'That is not what I meant', fr: "Ce n'est pas ce que je voulais dire" },
          { zh: '能不能 麻烦 您 帮 个 忙', py: 'néngbunéng máfan nín bāng ge máng', en: 'Could I ask you for some help?', fr: 'Puis-je vous demander un peu d\'aide ?' },
          { zh: '您 说 得 有 道理', py: 'nín shuō de yǒu dàolǐ', en: 'You have a point', fr: "Vous n'avez pas tort" },
        ],
      },
    ],
  },
  // ── C2 ──
  {
    title: { en: 'Chengyu: four-character idioms', fr: 'Chengyu : expressions en quatre caractères' },
    level: 'C2',
    tips: {
      en: 'Chengyu are fixed four-character expressions, often from classical stories. They work like a single word: 一举两得 (one action, two gains), 入乡随俗 (follow local customs). Use them sparingly in speech; they are common in writing.',
      fr: 'Les chengyu sont des expressions figées de quatre caractères, souvent tirées de récits anciens. Elles s\'emploient comme un seul mot : 一举两得 (une action, deux gains), 入乡随俗 (suivre les coutumes locales). À l\'oral, avec modération ; à l\'écrit, elles sont fréquentes.',
    },
    lessons: [
      {
        title: { en: 'Common chengyu', fr: 'Chengyu courants' },
        phrases: [
          { zh: '这样 做 一举两得', py: 'zhèyàng zuò yījǔliǎngdé', en: 'Doing it this way kills two birds with one stone', fr: "Faire ainsi c'est faire d'une pierre deux coups" },
          { zh: '学习 不 能 半途而废', py: 'xuéxí bù néng bàntú\'érfèi', en: 'You must not give up halfway when studying', fr: 'Il ne faut pas abandonner ses études à mi-chemin' },
          { zh: '我们 要 入乡随俗', py: 'wǒmen yào rùxiāngsuísú', en: 'We should do as the locals do', fr: 'Nous devons faire comme les gens d\'ici' },
          { zh: '他 的 中文 马马虎虎', py: 'tā de Zhōngwén mǎmǎhūhū', en: 'His Chinese is just okay', fr: 'Son chinois est moyen' },
          { zh: '熟能生巧 多 练习 吧', py: 'shúnéngshēngqiǎo duō liànxí ba', en: 'Practice makes perfect so keep at it', fr: "C'est en forgeant qu'on devient forgeron, entraîne-toi" },
        ],
      },
      {
        title: { en: 'More chengyu', fr: "D'autres chengyu" },
        phrases: [
          { zh: '他 总是 三心二意', py: 'tā zǒngshì sānxīn\'èryì', en: 'He can never make up his mind', fr: "Il n'arrive jamais à se décider" },
          { zh: '这 件 事 一言难尽', py: 'zhè jiàn shì yìyánnánjìn', en: 'It is a long story', fr: "C'est une longue histoire" },
          { zh: '我们 一见如故', py: 'wǒmen yíjiànrúgù', en: 'We got on like old friends at once', fr: 'Nous nous sommes tout de suite bien entendus' },
          { zh: '别 担心 车到山前必有路', py: 'bié dānxīn chēdàoshānqiánbìyǒulù', en: 'Do not worry things will work out', fr: "Ne t'inquiète pas, tout s'arrangera" },
          { zh: '他 做事 一丝不苟', py: 'tā zuòshì yìsībùgǒu', en: 'He is meticulous in everything he does', fr: "Il est méticuleux dans tout ce qu'il fait" },
        ],
      },
    ],
  },
  {
    title: { en: 'Mastery', fr: 'Maîtrise' },
    level: 'C2',
    tips: {
      en: 'Advanced pairs: 与其…不如… (rather than… better to…), 无论…都… (no matter… still…), 之所以…是因为… (the reason… is that…). 差点儿 means "very nearly". Spoken Chinese uses short set phrases: 算了吧, 慢慢来, 走一步看一步.',
      fr: 'Structures avancées : 与其…不如… (plutôt que… mieux vaut…), 无论…都… (quel que soit… quand même…), 之所以…是因为… (si… c\'est parce que…). 差点儿 veut dire « faillir ». L\'oral aime les formules courtes : 算了吧, 慢慢来, 走一步看一步.',
    },
    lessons: [
      {
        title: { en: 'Fine distinctions', fr: 'Nuances fines' },
        phrases: [
          { zh: '与其 抱怨 不如 想 办法', py: 'yǔqí bàoyuàn bùrú xiǎng bànfǎ', en: 'Rather than complain find a solution', fr: 'Plutôt que de te plaindre, trouve une solution' },
          { zh: '无论 多么 困难 我 都 不会 放弃', py: 'wúlùn duōme kùnnan wǒ dōu búhuì fàngqì', en: 'However hard it is I will not give up', fr: "Aussi difficile que ce soit, je n'abandonnerai pas" },
          { zh: '他 之所以 成功 是 因为 努力', py: 'tā zhīsuǒyǐ chénggōng shì yīnwèi nǔlì', en: 'The reason he succeeded is hard work', fr: "S'il a réussi, c'est grâce à ses efforts" },
          { zh: '我 差点儿 错过 了 飞机', py: 'wǒ chàdiǎnr cuòguò le fēijī', en: 'I very nearly missed the plane', fr: "J'ai failli rater l'avion" },
          { zh: '不管 怎么样 决定 已经 做 了', py: 'bùguǎn zěnmeyàng juédìng yǐjīng zuò le', en: 'Be that as it may the decision has been made', fr: "Quoi qu'il en soit, la décision est prise" },
        ],
      },
      {
        title: { en: 'Sounding natural', fr: 'Parler naturellement' },
        phrases: [
          { zh: '真 没想到', py: 'zhēn méixiǎngdào', en: 'I really did not expect that', fr: "Je ne m'y attendais vraiment pas" },
          { zh: '算 了 吧', py: 'suàn le ba', en: 'Forget it', fr: 'Laisse tomber' },
          { zh: '这 对 我 来说 很 重要', py: 'zhè duì wǒ láishuō hěn zhòngyào', en: 'This means a lot to me', fr: 'Ça compte beaucoup pour moi' },
          { zh: '慢慢 来 别 着急', py: 'mànmàn lái bié zháojí', en: 'Take your time do not rush', fr: 'Prends ton temps, ne te presse pas' },
          { zh: '走 一步 看 一步 吧', py: 'zǒu yíbù kàn yíbù ba', en: 'Let us take it one step at a time', fr: 'Avançons étape par étape' },
        ],
      },
    ],
  },
];
