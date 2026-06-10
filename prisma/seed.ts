import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123";

const usersData = [
  {
    email: "alice@example.com",
    username: "alice",
    displayName: "Alice Chen",
    bio: "Full-stack dev. TypeScript enthusiast. Café y commits antes del mediodía.",
  },
  {
    email: "bob@example.com",
    username: "bob",
    displayName: "Bob Martínez",
    bio: "Backend engineer en una startup. Rust curious. Padre de un gato llamado Null.",
  },
  {
    email: "carla@example.com",
    username: "carla",
    displayName: "Carla Ruiz",
    bio: "Frontend lead. Diseño accesible y CSS que no da pesadillas.",
  },
  {
    email: "diego@example.com",
    username: "diego",
    displayName: "Diego Fernández",
    bio: "DevOps / SRE. Si no está en Grafana, está en la bici.",
  },
  {
    email: "elena@example.com",
    username: "elena",
    displayName: "Elena Vargas",
    bio: "Product designer que codea. Prototipos rápidos y feedback honesto.",
  },
  {
    email: "frank@example.com",
    username: "frank",
    displayName: "Frank O'Brien",
    bio: "Mobile dev iOS/Android. Swift, Kotlin y demasiadas apps de notas.",
  },
  {
    email: "grace@example.com",
    username: "grace",
    displayName: "Grace Kim",
    bio: "ML engineer. Datasets, embeddings y memes de transformers.",
  },
  {
    email: "hugo@example.com",
    username: "hugo",
    displayName: "Hugo Silva",
    bio: "Freelance web dev. Next.js, Prisma y clientes con deadlines imposibles.",
  },
  {
    email: "iris@example.com",
    username: "iris",
    displayName: "Iris Nakamura",
    bio: "QA automation. Tests que fallan solo cuando tienen que fallar.",
  },
  {
    email: "juan@example.com",
    username: "juan",
    displayName: "Juan López",
    bio: "Estudiante de informática. Aprendiendo en público, un bug a la vez.",
  },
  {
    email: "kate@example.com",
    username: "kate",
    displayName: "Kate Morrison",
    bio: "Tech writer & developer advocate. Documentación clara o no documentación.",
  },
  {
    email: "leo@example.com",
    username: "leo",
    displayName: "Leo Pereira",
    bio: "Indie hacker. Side projects, open source y demasiado café frío.",
  },
];

const tweetContents = [
  "Acabo de migrar un monolito a microservicios. Spoiler: ahora tengo 12 monolitos.",
  "El bug más difícil es el que solo aparece en producción los viernes a las 18:00.",
  "Tip del día: nombrá tus variables como si alguien más fuera a leer tu código mañana.",
  "¿Alguien más siente que escribir tests es terapia pero en forma de assert?",
  "Deploy exitoso. Celebración: cerrar 3 pestañas del navegador que ya no necesitaba.",
  "Hoy aprendí que SQLite aguanta más de lo que mi arquitectura inicial merecía.",
  "La mejor feature es la que no tenés que explicar en una reunión de 45 minutos.",
  "Me tomé un break de 10 minutos y volví con la solución. Descansar también es debugging.",
  "CSS: 2 horas para centrar un div. Clásico.",
  "Pair programming salió bien. Dos cerebros, un teclado, cero ego.",
  "Refactoricé 200 líneas y el diff quedó más limpio que mi escritorio.",
  "La vida cotidiana: comprar leche, pagar el wifi, pushear a main sin miedo.",
  "Next.js App Router ya no me asusta. Bueno, un poco sí los loading states.",
  "Prisma + SQLite para un side project es una combinación subestimada.",
  "¿Por qué siempre el cable del cargador se rompe en la punta más incómoda?",
  "Leí un RFC entero por curiosidad. Ahora entiendo por qué nadie lee RFCs enteros.",
  "Standup de hoy: ayer codeé, hoy codeo, bloqueos: la falta de café.",
  "Open source: regalás horas y recibís issues con solo un emoji. Vale la pena igual.",
  "Mi IDE tiene más extensiones que mi nevera tiene condimentos.",
  "Hice meal prep y batch de commits. Productividad doméstica nivel senior.",
  "El semáforo en rojo es el mejor momento para repasar mentalmente un algoritmo.",
  "TypeScript salvó mi PR otra vez. Gracias, tipos, nunca cambien.",
  "La reunión pudo ser un tweet. Fue un tweet después de la reunión.",
  "Configuré CI en 20 minutos. Arreglar el pipeline: el resto de la tarde.",
  "Domingo de limpiar node_modules y la conciencia.",
  "Aprender un framework nuevo es como mudarse: todo cajas al principio.",
  "Hoy el linter fue más estricto que yo con la fecha de vencimiento de la leche.",
  "Remote work pro: pantuflas en standup. Remote work contra: nevera a 3 metros.",
  "Escribí documentación antes del código. Milagro confirmado.",
  "El WiFi cayó justo cuando iba a hacer push. El universo tiene timing cómico.",
  "GraphQL vs REST: la discusión eterna. Hoy elegí dormir temprano.",
  "Mi planta sobrevivió otra semana. Mi racha de commits también.",
  "Code review amable > code review que duele. Siempre.",
  "Probé una app nueva de productividad. Volví a la lista en papel.",
  "El mejor commit message de hoy: 'fix stuff'. Mañana lo mejoro. Tal vez.",
  "Hackeando la vida: batch cooking, batch laundry, batch git fetch.",
  "La oficina sonaba a teclados. Mi casa suena a teclado y a lavarropes.",
  "Le conté a un amigo que soy dev. Ahora soy soporte técnico oficial de su familia.",
  "Encontré un podcast bueno sobre arquitectura. Perdí la noción del tiempo.",
  "Hoy el build pasó a la primera. Documentando para la posteridad.",
];

function pickFollowTargets(userIndex: number, userCount: number): number[] {
  const followCount = 3 + ((userIndex * 3) % 6);
  const targets: number[] = [];

  for (let j = 0; j < followCount; j++) {
    let target = (userIndex + j * 5 + 1) % userCount;

    while (target === userIndex || targets.includes(target)) {
      target = (target + 1) % userCount;
    }

    targets.push(target);
  }

  return targets;
}

function pickLikeAuthors(
  tweetIndex: number,
  authorIndex: number,
  userCount: number
): number[] {
  const likeCount = (tweetIndex * 7 + authorIndex) % 9;
  const likers: number[] = [];

  for (let k = 0; k < likeCount; k++) {
    let liker = (tweetIndex + k * 3 + 2) % userCount;

    while (liker === authorIndex || likers.includes(liker)) {
      liker = (liker + 1) % userCount;
    }

    likers.push(liker);
  }

  return likers;
}

async function main() {
  console.log("🌱 Iniciando seed...");

  await prisma.notification.deleteMany();
  await prisma.like.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.tweet.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const users = await Promise.all(
    usersData.map((user) =>
      prisma.user.create({
        data: {
          ...user,
          passwordHash,
        },
      })
    )
  );

  const tweets: { id: string; authorId: string; authorIndex: number }[] = [];

  for (let userIndex = 0; userIndex < users.length; userIndex++) {
    const tweetCount = 5 + ((userIndex * 4) % 11);

    for (let t = 0; t < tweetCount; t++) {
      const contentIndex = (userIndex * 13 + t * 7) % tweetContents.length;
      const tweet = await prisma.tweet.create({
        data: {
          content: tweetContents[contentIndex],
          authorId: users[userIndex].id,
        },
      });

      tweets.push({
        id: tweet.id,
        authorId: tweet.authorId,
        authorIndex: userIndex,
      });
    }
  }

  for (let userIndex = 0; userIndex < users.length; userIndex++) {
    const targets = pickFollowTargets(userIndex, users.length);

    for (const targetIndex of targets) {
      await prisma.follow.create({
        data: {
          followerId: users[userIndex].id,
          followingId: users[targetIndex].id,
        },
      });

      await prisma.notification.create({
        data: {
          userId: users[targetIndex].id,
          actorId: users[userIndex].id,
          type: "FOLLOW",
        },
      });
    }
  }

  for (let tweetIndex = 0; tweetIndex < tweets.length; tweetIndex++) {
    const tweet = tweets[tweetIndex];
    const likers = pickLikeAuthors(
      tweetIndex,
      tweet.authorIndex,
      users.length
    );

    for (const likerIndex of likers) {
      await prisma.like.create({
        data: {
          userId: users[likerIndex].id,
          tweetId: tweet.id,
        },
      });

      if (likerIndex !== tweet.authorIndex) {
        await prisma.notification.create({
          data: {
            userId: tweet.authorId,
            actorId: users[likerIndex].id,
            type: "LIKE",
            tweetId: tweet.id,
          },
        });
      }
    }
  }

  console.log("✅ Seed completado");
  console.log("👤 Usuario de prueba: alice@example.com / password123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
