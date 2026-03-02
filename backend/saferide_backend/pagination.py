from rest_framework.pagination import PageNumberPagination


class DynamicPageSizePagination(PageNumberPagination):
    """Allow clients to override page size via ?page_size= query param."""
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 200
