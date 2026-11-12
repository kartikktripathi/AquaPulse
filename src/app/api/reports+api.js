import prisma from '../../lib/prisma';

export async function GET(request) {
  try {
    const reports = await prisma.report.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Parse photos JSON back to arrays for client convenience
    const formatted = reports.map((r) => {
      let parsedPhotos = [];
      try {
        parsedPhotos = typeof r.photos === 'string' ? JSON.parse(r.photos) : r.photos;
      } catch (e) {
        parsedPhotos = [];
      }
      return {
        ...r,
        photos: parsedPhotos,
      };
    });

    return Response.json({ success: true, reports: formatted });
  } catch (error) {
    console.error('Failed to fetch reports from Prisma database:', error);
    return Response.json(
      { success: false, error: error.message || 'Database fetch failed' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body || !body.name) {
      return Response.json(
        { success: false, error: 'Problem name is required' },
        { status: 400 }
      );
    }

    const photosJson =
      typeof body.photos === 'string'
        ? body.photos
        : JSON.stringify(Array.isArray(body.photos) ? body.photos : []);

    const createdReport = await prisma.report.create({
      data: {
        name: body.name.trim(),
        categoryId: body.categoryId || 'other',
        categoryLabel: body.categoryLabel || body.category || 'Other',
        addressLine1:
          body.address?.line1 || body.addressLine1 || 'Unknown Street',
        addressLine2: body.address?.line2 || body.addressLine2 || null,
        landmark: body.address?.landmark || body.landmark || '',
        description: body.description || '',
        photos: photosJson,
        status: body.status || 'reported',
        latitude: parseFloat(body.coordinates?.latitude ?? body.latitude ?? 0),
        longitude: parseFloat(
          body.coordinates?.longitude ?? body.longitude ?? 0
        ),
        userLatitude:
          body.userCoordinates?.latitude !== undefined
            ? parseFloat(body.userCoordinates.latitude)
            : body.userLatitude !== undefined
            ? parseFloat(body.userLatitude)
            : null,
        userLongitude:
          body.userCoordinates?.longitude !== undefined
            ? parseFloat(body.userCoordinates.longitude)
            : body.userLongitude !== undefined
            ? parseFloat(body.userLongitude)
            : null,
        distanceFromUser: parseFloat(
          body.distanceFromUser ?? body.distance ?? 0
        ),
      },
    });

    let parsedPhotos = [];
    try {
      parsedPhotos = JSON.parse(createdReport.photos);
    } catch (e) {
      parsedPhotos = [];
    }

    return Response.json(
      {
        success: true,
        report: {
          ...createdReport,
          photos: parsedPhotos,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create report in Prisma database:', error);
    return Response.json(
      { success: false, error: error.message || 'Database insert failed' },
      { status: 500 }
    );
  }
}

