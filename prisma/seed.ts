import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  {
    name: "Alimentação",
    icon: "utensils",
    color: "#E74C3C",
    isIncome: false,
    children: [
      { name: "Restaurantes", icon: "fork-knife", color: "#E74C3C" },
      { name: "Mercado", icon: "shopping-cart", color: "#E74C3C" },
      { name: "Delivery", icon: "bike", color: "#E74C3C" },
      { name: "Padaria e Café", icon: "coffee", color: "#E74C3C" },
    ],
  },
  {
    name: "Transporte",
    icon: "car",
    color: "#3498DB",
    isIncome: false,
    children: [
      { name: "Combustível", icon: "fuel", color: "#3498DB" },
      { name: "Uber / Táxi", icon: "car-taxi-front", color: "#3498DB" },
      { name: "Transporte Público", icon: "bus", color: "#3498DB" },
      { name: "Manutenção Veículo", icon: "wrench", color: "#3498DB" },
      { name: "Pedágio / Estacionamento", icon: "parking-circle", color: "#3498DB" },
    ],
  },
  {
    name: "Moradia",
    icon: "home",
    color: "#9B59B6",
    isIncome: false,
    children: [
      { name: "Aluguel", icon: "key", color: "#9B59B6" },
      { name: "Condomínio", icon: "building-2", color: "#9B59B6" },
      { name: "Água e Esgoto", icon: "droplets", color: "#9B59B6" },
      { name: "Luz / Energia", icon: "zap", color: "#9B59B6" },
      { name: "Gás", icon: "flame", color: "#9B59B6" },
      { name: "Internet / TV", icon: "wifi", color: "#9B59B6" },
      { name: "Manutenção / Reforma", icon: "hammer", color: "#9B59B6" },
    ],
  },
  {
    name: "Saúde",
    icon: "heart-pulse",
    color: "#1ABC9C",
    isIncome: false,
    children: [
      { name: "Plano de Saúde", icon: "shield-check", color: "#1ABC9C" },
      { name: "Farmácia", icon: "pill", color: "#1ABC9C" },
      { name: "Consultas", icon: "stethoscope", color: "#1ABC9C" },
      { name: "Exames", icon: "clipboard-list", color: "#1ABC9C" },
      { name: "Academia / Esportes", icon: "dumbbell", color: "#1ABC9C" },
    ],
  },
  {
    name: "Educação",
    icon: "graduation-cap",
    color: "#F39C12",
    isIncome: false,
    children: [
      { name: "Mensalidade", icon: "school", color: "#F39C12" },
      { name: "Cursos Online", icon: "monitor-play", color: "#F39C12" },
      { name: "Livros e Material", icon: "book-open", color: "#F39C12" },
    ],
  },
  {
    name: "Lazer e Entretenimento",
    icon: "tv",
    color: "#E67E22",
    isIncome: false,
    children: [
      { name: "Streaming", icon: "play-circle", color: "#E67E22" },
      { name: "Cinema e Shows", icon: "clapperboard", color: "#E67E22" },
      { name: "Viagens", icon: "plane", color: "#E67E22" },
      { name: "Hobbies", icon: "palette", color: "#E67E22" },
      { name: "Bar e Balada", icon: "beer", color: "#E67E22" },
    ],
  },
  {
    name: "Vestuário",
    icon: "shirt",
    color: "#EC407A",
    isIncome: false,
    children: [
      { name: "Roupas", icon: "shirt", color: "#EC407A" },
      { name: "Calçados", icon: "footprints", color: "#EC407A" },
      { name: "Acessórios", icon: "watch", color: "#EC407A" },
    ],
  },
  {
    name: "Tecnologia",
    icon: "laptop",
    color: "#607D8B",
    isIncome: false,
    children: [
      { name: "Eletrônicos", icon: "smartphone", color: "#607D8B" },
      { name: "Software / Assinaturas", icon: "app-window", color: "#607D8B" },
      { name: "Telefone / Plano", icon: "phone", color: "#607D8B" },
    ],
  },
  {
    name: "Animais de Estimação",
    icon: "paw-print",
    color: "#8D6E63",
    isIncome: false,
    children: [
      { name: "Ração e Petshop", icon: "shopping-bag", color: "#8D6E63" },
      { name: "Veterinário", icon: "syringe", color: "#8D6E63" },
      { name: "Plano Pet", icon: "shield", color: "#8D6E63" },
    ],
  },
  {
    name: "Impostos e Taxas",
    icon: "landmark",
    color: "#546E7A",
    isIncome: false,
    children: [
      { name: "IPTU", icon: "receipt", color: "#546E7A" },
      { name: "IPVA", icon: "car-front", color: "#546E7A" },
      { name: "IR / DARF", icon: "file-text", color: "#546E7A" },
      { name: "IOF / Taxas bancárias", icon: "percent", color: "#546E7A" },
    ],
  },
  {
    name: "Investimentos",
    icon: "trending-up",
    color: "#2E7D32",
    isIncome: false,
    children: [
      { name: "Renda Variável", icon: "bar-chart-2", color: "#2E7D32" },
      { name: "Renda Fixa", icon: "landmark", color: "#2E7D32" },
      { name: "Criptomoedas", icon: "bitcoin", color: "#2E7D32" },
      { name: "Previdência", icon: "piggy-bank", color: "#2E7D32" },
    ],
  },
  {
    name: "Renda",
    icon: "wallet",
    color: "#27AE60",
    isIncome: true,
    children: [
      { name: "Salário", icon: "briefcase", color: "#27AE60" },
      { name: "Freelance", icon: "laptop-2", color: "#27AE60" },
      { name: "Rendimentos", icon: "trending-up", color: "#27AE60" },
      { name: "Aluguel Recebido", icon: "key-round", color: "#27AE60" },
      { name: "Reembolso", icon: "refresh-ccw", color: "#27AE60" },
      { name: "Caronas", icon: "car", color: "#27AE60" },
      { name: "Bolsa Acadêmica", icon: "graduation-cap", color: "#27AE60" },
      { name: "Outros Créditos", icon: "plus-circle", color: "#27AE60" },
    ],
  },
  {
    name: "Transferência Interna",
    icon: "arrow-right-left",
    color: "#95A5A6",
    isIncome: false,
    isSystem: true,
    children: [],
  },
  {
    name: "Outros",
    icon: "circle",
    color: "#BDC3C7",
    isIncome: false,
    children: [
      { name: "Presentes e Doações", icon: "gift", color: "#BDC3C7" },
      { name: "Seguros", icon: "shield", color: "#BDC3C7" },
      { name: "Despesas Diversas", icon: "more-horizontal", color: "#BDC3C7" },
    ],
  },
];

async function main() {
  console.log("Seeding categorias padrão...");

  for (const cat of categories) {
    const { children, ...parentData } = cat;

    const parent = await prisma.category.upsert({
      where: { id: `sys_${cat.name.toLowerCase().replace(/\s+/g, "_")}` },
      update: {},
      create: {
        id: `sys_${cat.name.toLowerCase().replace(/\s+/g, "_")}`,
        name: parentData.name,
        icon: parentData.icon,
        color: parentData.color,
        isSystem: parentData.isSystem ?? true,
        isIncome: parentData.isIncome ?? false,
      },
    });

    for (const child of children) {
      await prisma.category.upsert({
        where: {
          id: `sys_${cat.name.toLowerCase().replace(/\s+/g, "_")}_${child.name.toLowerCase().replace(/\s+/g, "_")}`,
        },
        update: {},
        create: {
          id: `sys_${cat.name.toLowerCase().replace(/\s+/g, "_")}_${child.name.toLowerCase().replace(/\s+/g, "_")}`,
          name: child.name,
          icon: child.icon,
          color: child.color,
          isSystem: true,
          isIncome: parentData.isIncome ?? false,
          parentId: parent.id,
        },
      });
    }
  }

  // Perfil padrão
  await prisma.profile.upsert({
    where: { id: "default_profile" },
    update: {},
    create: {
      id: "default_profile",
      name: "Meu Perfil",
      color: "#2E6DA4",
      isDefault: true,
    },
  });

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
