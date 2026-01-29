import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, baseUrl } = body;

    if (!username || !password || !baseUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Call Magento API from the server (no CORS issues)
    const response = await axios.post<string>(
      `${baseUrl}/rest/V1/integration/admin/token`,
      { username, password },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Magento returns the token as a plain string
    const token = response.data;

    return NextResponse.json({ token });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return NextResponse.json(
          {
            error: `Authentication failed: ${error.response.status} - ${error.response.statusText}`,
          },
          { status: error.response.status }
        );
      } else if (error.request) {
        return NextResponse.json(
          { error: 'No response from server. Please check your network connection.' },
          { status: 503 }
        );
      }
    }
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}