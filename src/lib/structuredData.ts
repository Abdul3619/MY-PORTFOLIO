/**
 * Schema.org JSON-LD Structured Data Generator
 * Provides rich search engine metadata for Author, Services, WebSite, and Project Portfolio.
 */

export interface StructuredDataOptions {
  route: string;
  baseUrl?: string;
  profile?: any;
  contactInfo?: any;
  projects?: any[];
  services?: any[];
  testimonials?: any[];
}

export function buildStructuredData(options: StructuredDataOptions) {
  const {
    route = '/',
    baseUrl: rawBaseUrl,
    profile = {},
    contactInfo = {},
    projects = [],
    testimonials = []
  } = options;

  let baseUrl =
    rawBaseUrl ||
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    'https://abdulwahab.dev';

  baseUrl = baseUrl.replace(/\/+$/, '');

  const authorName = profile?.name || 'Abdul Wahab';
  const authorTitle = profile?.title || 'Web Developer & Solar Technician';
  
  let rawBio = profile?.bio;
  if (typeof rawBio === 'string' && rawBio.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawBio);
      rawBio = parsed.bio || parsed.bio_text;
    } catch {
      rawBio = null;
    }
  }
  const authorBio =
    rawBio ||
    'I build fast, responsive web applications and implement reliable solar solutions.';
  const authorImage =
    profile?.profile_image_url ||
    'https://aqilclozwukdnogqcmsy.supabase.co/storage/v1/object/public/media/1784963700643_1784963665581.png';
  const email = contactInfo?.email || 'abdulwahababdullah3619@gmail.com';
  const phone = contactInfo?.phone || '+2349117644855';
  const github = contactInfo?.github_url || 'https://github.com/abdul3619';
  const linkedin =
    contactInfo?.linkedin_url ||
    'https://www.linkedin.com/in/abdulwahab-abdullahi-3663143b3';
  const whatsapp = contactInfo?.whatsapp
    ? `https://api.whatsapp.com/send?phone=${contactInfo.whatsapp.replace(/[^0-9]/g, '')}`
    : 'https://api.whatsapp.com/send?phone=22871606697';

  // 1. Author (Person)
  const personEntity: Record<string, any> = {
    '@type': 'Person',
    '@id': `${baseUrl}/#author`,
    name: authorName,
    alternateName: 'Abdul Wahab Abdullah',
    jobTitle: authorTitle,
    description: authorBio,
    url: baseUrl,
    image: authorImage,
    email: `mailto:${email}`,
    telephone: phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: contactInfo?.address || 'Oloofa st, oorelope 24, Araromi Omotosho Compound',
      addressLocality: contactInfo?.location || 'Accra',
      addressCountry: 'Ghana'
    },
    sameAs: [github, linkedin, whatsapp].filter(Boolean),
    knowsAbout: [
      'Web Development',
      'Frontend Architecture',
      'TypeScript',
      'JavaScript',
      'React.js',
      'Next.js',
      'Tailwind CSS',
      'Node.js',
      'Express.js',
      'PostgreSQL',
      'Supabase Database',
      'RESTful APIs',
      'Solar Photovoltaic (PV) Engineering',
      'Inverter Sizing & Configuration',
      'Battery Storage Systems',
      'Renewable Energy Integration'
    ],
    alumniOf: [
      {
        '@type': 'EducationalOrganization',
        name: 'Technical Institute of Engineering',
        description: 'Diploma in Renewable Energy & Solar Systems'
      },
      {
        '@type': 'EducationalOrganization',
        name: 'Frontend Masters',
        description: 'Advanced React & Modern JavaScript Patterns'
      },
      {
        '@type': 'EducationalOrganization',
        name: 'Udacity',
        description: 'Full Stack Web Development Nanodegree'
      }
    ]
  };

  // 2. Professional Services & Business Entity
  const serviceCatalog = [
    {
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'Full-Stack Web Application Development',
        description:
          'Engineering custom, responsive web applications utilizing React, Next.js, TypeScript, Tailwind CSS, Node.js, and secure cloud databases.'
      }
    },
    {
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'High-Performance Frontend & UI/UX Engineering',
        description:
          'Creating fluid, accessible, and high-conversion user interfaces with GSAP animations, responsive design, and sub-second load times.'
      }
    },
    {
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'Solar Power System Sizing & Engineering Consulting',
        description:
          'Calculating household and commercial energy loads, PV array capacity, inverter sizing, and battery bank autonomy for clean energy.'
      }
    },
    {
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'E-Commerce Solutions & Custom Booking Platforms',
        description:
          'Developing interactive product catalogs, real-time booking engines, CRM integrations, and payment workflows.'
      }
    },
    {
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'Interactive Web Utilities & Solar Estimators',
        description:
          'Building customized client-facing tools, calculators, and interactive widgets to streamline customer estimates and data collection.'
      }
    }
  ];

  const professionalServiceEntity: Record<string, any> = {
    '@type': 'ProfessionalService',
    '@id': `${baseUrl}/#service`,
    name: `${authorName} – Web Development & Solar Engineering`,
    description:
      'High-performance web application development and certified solar energy engineering solutions.',
    url: baseUrl,
    image: authorImage,
    telephone: phone,
    email: email,
    provider: { '@id': `${baseUrl}/#author` },
    priceRange: '$$',
    areaServed: [
      { '@type': 'Place', name: 'Worldwide' },
      { '@type': 'Country', name: 'Ghana' },
      { '@type': 'Country', name: 'Nigeria' }
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: contactInfo?.address || 'Oloofa st, oorelope 24',
      addressCountry: 'Ghana'
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Engineering & Technology Services',
      itemListElement: serviceCatalog
    }
  };

  // 3. WebSite Entity
  const websiteEntity: Record<string, any> = {
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    url: baseUrl,
    name: `${authorName} – Portfolio & Technology Services`,
    description: authorBio,
    publisher: { '@id': `${baseUrl}/#author` },
    inLanguage: ['en', 'fr', 'ar']
  };

  const graph: any[] = [personEntity, professionalServiceEntity, websiteEntity];

  // 4. Route-Specific Entities
  const canonicalUrl = `${baseUrl}${route === '/' ? '' : route}`;

  if (route === '/') {
    graph.push({
      '@type': 'WebPage',
      '@id': `${baseUrl}/#webpage`,
      url: baseUrl,
      name: `${authorName} – ${authorTitle}`,
      description: authorBio,
      isPartOf: { '@id': `${baseUrl}/#website` },
      about: { '@id': `${baseUrl}/#author` }
    });
  } else if (route === '/about') {
    graph.push({
      '@type': 'AboutPage',
      '@id': `${canonicalUrl}/#aboutpage`,
      url: canonicalUrl,
      name: `About ${authorName} – Journey, Vision & Engineering Philosophy`,
      description:
        'The journey of Abdul Wahab from physical solar engineering to self-taught full-stack software development.',
      isPartOf: { '@id': `${baseUrl}/#website` },
      mainEntity: { '@id': `${baseUrl}/#author` }
    });
  } else if (route === '/skills') {
    graph.push({
      '@type': 'WebPage',
      '@id': `${canonicalUrl}/#skillspage`,
      url: canonicalUrl,
      name: `Skills & Technical Toolkit – ${authorName}`,
      description:
        'Comprehensive technical capabilities in frontend, backend, database architectures, and solar photovoltaic systems.',
      isPartOf: { '@id': `${baseUrl}/#website` },
      about: { '@id': `${baseUrl}/#author` }
    });
  } else if (route === '/projects') {
    // Project Portfolio List
    const projectListElements = (projects || []).slice(0, 15).map((p, idx) => {
      const slug = p.slug || p.id;
      const techStack = Array.isArray(p.tech_stack)
        ? p.tech_stack
        : Array.isArray(p.techStack)
        ? p.techStack
        : [];
      return {
        '@type': 'ListItem',
        position: idx + 1,
        item: {
          '@type': 'SoftwareApplication',
          name: p.title,
          description: p.description || p.longDescription || '',
          applicationCategory: 'WebApplication',
          operatingSystem: 'All Web Browsers',
          url: `${baseUrl}/projects/${slug}`,
          image: p.thumbnail_url || p.hero_image_url || p.image || authorImage,
          keywords: techStack.join(', '),
          creator: { '@id': `${baseUrl}/#author` }
        }
      };
    });

    graph.push({
      '@type': 'CollectionPage',
      '@id': `${canonicalUrl}/#collection`,
      url: canonicalUrl,
      name: `Featured Projects & Portfolio Work – ${authorName}`,
      description:
        'A curated showcase of modern web applications, luxury hotel platforms, booking engines, and digital tools created by Abdul Wahab.',
      isPartOf: { '@id': `${baseUrl}/#website` },
      mainEntity: {
        '@type': 'ItemList',
        name: 'Engineering & Software Projects',
        numberOfItems: projectListElements.length,
        itemListElement: projectListElements
      }
    });
  } else if (route.startsWith('/projects/')) {
    const slug = route.replace('/projects/', '').trim();
    const currentProject = (projects || []).find((p) => p.slug === slug || p.id === slug);

    if (currentProject) {
      const techStack = Array.isArray(currentProject.tech_stack)
        ? currentProject.tech_stack
        : Array.isArray(currentProject.techStack)
        ? currentProject.techStack
        : [];

      graph.push({
        '@type': 'SoftwareApplication',
        '@id': `${canonicalUrl}/#app`,
        url: canonicalUrl,
        name: currentProject.title,
        description: currentProject.description || currentProject.longDescription || '',
        image:
          currentProject.hero_image_url ||
          currentProject.thumbnail_url ||
          currentProject.image ||
          authorImage,
        applicationCategory: 'WebApplication',
        operatingSystem: 'All Modern Web Browsers',
        creator: { '@id': `${baseUrl}/#author` },
        author: { '@id': `${baseUrl}/#author` },
        keywords: techStack.join(', '),
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        }
      });
    }
  } else if (route === '/solar-estimator') {
    graph.push({
      '@type': 'WebApplication',
      '@id': `${canonicalUrl}/#estimator`,
      url: canonicalUrl,
      name: 'Interactive Solar System Sizing Estimator & Power Calculator',
      description:
        'An interactive engineering tool to calculate household power consumption, solar panel count, battery storage capacity, and estimated system pricing.',
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'All Web Browsers',
      creator: { '@id': `${baseUrl}/#author` },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      }
    });
  } else if (route === '/testimonials') {
    const reviewElements = (testimonials || []).slice(0, 10).map((t, idx) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: t.name || 'Client'
      },
      reviewBody: t.content || t.review || '',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: t.rating || 5,
        bestRating: 5,
        worstRating: 1
      },
      itemReviewed: { '@id': `${baseUrl}/#service` }
    }));

    graph.push({
      '@type': 'CollectionPage',
      '@id': `${canonicalUrl}/#testimonials`,
      url: canonicalUrl,
      name: `Client Testimonials & Recommendations – ${authorName}`,
      description:
        'Genuine feedback and reviews from founders, agency owners, and collaborators who have worked with Abdul Wahab.',
      isPartOf: { '@id': `${baseUrl}/#website` },
      mainEntity: {
        '@type': 'ItemList',
        name: 'Client Reviews',
        numberOfItems: reviewElements.length,
        itemListElement: reviewElements
      }
    });
  } else if (route === '/resume') {
    graph.push({
      '@type': 'ProfilePage',
      '@id': `${canonicalUrl}/#resumepage`,
      url: canonicalUrl,
      name: `Resume & Technical Credentials – ${authorName}`,
      description:
        'Professional experience, education, verified certifications, and career accomplishments of Abdul Wahab.',
      isPartOf: { '@id': `${baseUrl}/#website` },
      mainEntity: { '@id': `${baseUrl}/#author` }
    });
  } else if (route === '/certificates') {
    graph.push({
      '@type': 'CollectionPage',
      '@id': `${canonicalUrl}/#certificates`,
      url: canonicalUrl,
      name: `Certificates & Verified Credentials – ${authorName}`,
      description:
        'Industry certifications, awards, and technical milestones in modern web engineering and solar energy system design.',
      isPartOf: { '@id': `${baseUrl}/#website` },
      about: { '@id': `${baseUrl}/#author` }
    });
  } else if (route === '/contact') {
    graph.push({
      '@type': 'ContactPage',
      '@id': `${canonicalUrl}/#contactpage`,
      url: canonicalUrl,
      name: `Contact ${authorName} – Let's Build Something Extraordinary`,
      description:
        'Direct inquiry and consultation channel for full-stack software development projects and solar energy solutions.',
      isPartOf: { '@id': `${baseUrl}/#website` },
      mainEntity: { '@id': `${baseUrl}/#service` }
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph
  };
}
